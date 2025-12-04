// src/services/Classifier.js
// Python classifier wrapper

const { exec } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class Classifier {
  constructor(config) {
    this.config = config;
    this.pythonCmd = config.pythonCmd;
    this.classifierPath = this.resolveClassifierPath(config.paths.classifier);
    this.validExtensions = config.validExtensions;
  }

  /**
   * Resolve classifier script path (packaged + dev)
   */
  resolveClassifierPath(providedPath) {
    const candidates = [];

    // Explicit path
    if (providedPath) candidates.push(providedPath);

    // Next to the exe (pkg)
    if (process.execPath) {
      const execDir = path.dirname(process.execPath);
      candidates.push(path.join(execDir, "run_classifier.py"));
      candidates.push(path.join(execDir, "..", "run_classifier.py"));
    }

    // Bundled relative (snapshot)
    candidates.push(path.join(__dirname, "..", "run_classifier.py"));

    // Project root (dev)
    candidates.push(path.join(this.config.projectRoot, "run_classifier.py"));
    candidates.push(path.join(process.cwd(), "run_classifier.py"));

    for (const p of candidates) {
      try {
        if (fsSync.existsSync(p)) {
          return p;
        }
      } catch (_) { /* ignore */ }
    }

    return providedPath;
  }

  /**
   * Run the batch classifier on files in input directory
   */
  async classifyFiles(inputDir, unprocessedDir) {
    if (!fsSync.existsSync(this.classifierPath)) {
      console.warn('Classifier not found:', this.classifierPath);
      return { ok: false, error: 'Classifier script not found' };
    }

    // Check if there are any files to classify
    let inputFiles = [];
    try {
      const files = await fs.readdir(inputDir);
      inputFiles = files.filter(f => {
        const ext = path.extname(f).toLowerCase();
        return this.validExtensions.includes(ext);
      });

      if (inputFiles.length === 0) {
        console.log('No files to classify in input folder');
        return { ok: true, message: 'No files to classify' };
      }

      console.log(`Found ${inputFiles.length} file(s) to classify:`);
      inputFiles.slice(0, 5).forEach(f => console.log(`   - ${f}`));
      if (inputFiles.length > 5) console.log(`   ... and ${inputFiles.length - 5} more`);

    } catch (e) {
      console.warn('Could not read input directory:', e.message);
      return { ok: false, error: 'Could not read input directory' };
    }

    const cmd = `"${this.pythonCmd}" "${this.classifierPath}" "${inputDir}" "${unprocessedDir}"`;

    console.log('Starting batch classifier...');
    console.log(`Command: ${cmd}`);
    console.log(`Input dir: ${inputDir}`);
    console.log(`Output dir: ${unprocessedDir}`);

    return new Promise((resolve) => {
      const startTime = Date.now();

      exec(cmd, {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: 30000,
        env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' })
      }, async (error, stdout, stderr) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (error) {
          console.error('Classifier execution error:', error.message);
          if (error.code) console.error('   Error code:', error.code);
          if (error.signal) console.error('   Signal:', error.signal);

          if (stderr && stderr.trim()) {
            console.error('Classifier stderr:');
            console.error(stderr.trim().slice(0, 2000));
          }

          return resolve({
            ok: false,
            error: error.message,
            stderr: stderr ? stderr.trim() : null,
            duration
          });
        }

        if (stderr && stderr.trim()) {
          console.warn('Classifier warnings:');
          const stderrLines = stderr.trim().split('\n');
          stderrLines.slice(0, 10).forEach(line => console.warn(`   ${line}`));
          if (stderrLines.length > 10) {
            console.warn(`   ... and ${stderrLines.length - 10} more warning lines`);
          }
        }

        const out = (stdout || '').trim();

        if (!out) {
          console.log('Classifier produced no output');
          console.log(`Duration: ${duration}s`);
          return resolve({ ok: false, error: 'No output from classifier', duration });
        }

        // Log raw output for debugging
        console.log('\nClassifier output:');
        console.log('-'.repeat(60));
        const outputLines = out.split('\n');
        outputLines.forEach((line, idx) => {
          if (idx < 20 || idx >= outputLines.length - 10) {
            console.log(line);
          } else if (idx === 20) {
            console.log(`... ${outputLines.length - 30} more lines ...`);
          }
        });
        console.log('-'.repeat(60));

        // Parse JSON results
        const results = this.parseResults(out);

        console.log(`\nClassification Results:`);
        if (results.length > 0) {
          console.log(`Parsed ${results.length} classification result(s)`);

          let bankCount = 0;
          let nonBankCount = 0;

          results.forEach((obj, idx) => {
            const isBank = !!obj.is_bank_statement || !!obj.is_bank;
            const fileName = obj.file_path ? path.basename(obj.file_path) : obj.filename || `result_${idx + 1}`;
            const confidence = obj.confidence || obj.confidence_score || 0;

            if (isBank) {
              bankCount++;
              console.log(`   ${idx + 1}. BANK STATEMENT - ${fileName} (${confidence}%)`);
            } else {
              nonBankCount++;
              console.log(`   ${idx + 1}. Not bank - ${fileName} (${confidence}%)`);
            }
          });

          console.log(`\nSummary:`);
          console.log(`   Bank statements: ${bankCount}`);
          console.log(`   Non-bank files: ${nonBankCount}`);
          console.log(`   Total classified: ${results.length}`);

        } else {
          console.warn('Could not parse any JSON results from classifier output');
          console.log('This might mean:');
          console.log('   - Classifier is running but not outputting JSON');
          console.log('   - Check run_classifier.py for proper JSON output format');
        }

        console.log(`Duration: ${duration}s`);
        console.log('Classifier completed\n');

        resolve({
          ok: true,
          parsed: results,
          raw: out,
          duration,
          filesProcessed: results.length,
          bankStatements: results.filter(obj => !!obj.is_bank_statement || !!obj.is_bank).length
        });
      });
    });
  }

  /**
   * Parse JSON results from classifier output
   */
  parseResults(output) {
    const lines = output.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const jsonObjects = [];

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.startsWith('{') && l.endsWith('}')) {
        try {
          const parsed = JSON.parse(l);
          jsonObjects.push(parsed);
        } catch (e) {
          // Try to extract JSON if embedded in other text
          const first = l.indexOf('{');
          const last = l.lastIndexOf('}');
          if (first !== -1 && last !== -1 && last > first) {
            const sub = l.substring(first, last + 1);
            try {
              const parsed = JSON.parse(sub);
              jsonObjects.push(parsed);
            } catch (_) {}
          }
        }
      }
    }

    return jsonObjects;
  }
}

module.exports = Classifier;
