// const { Service } = require('node-windows');
// const path = require('path');

// // Create a new service object
// const svc = new Service({
//     name: 'Email Background Service',
//     description: 'Background service for processing bank statement emails',
//     script: path.join(__dirname, 'background-service.js'),
//     nodeOptions: [
//         '--harmony',
//         '--max_old_space_size=4096'
//     ]
// });

// // Listen for the "install" event, which indicates the
// // process is available as a service.
// svc.on('install', function() {
//     console.log('✅ Service installed successfully');
//     console.log('🚀 Starting service...');
//     svc.start();
// });

// svc.on('alreadyinstalled', function() {
//     console.log('ℹ️ Service is already installed');
// });

// svc.on('start', function() {
//     console.log('🎉 Service started successfully');
// });

// // Install the service
// console.log('🔧 Installing background service...');
// svc.install();










const { Service } = require('node-windows');
const path = require('path');

// Create a new service object
const svc = new Service({
    name: 'Email Background Service',
    description: 'Background service for processing bank statement emails',
    script: path.join(__dirname, 'server.js'),
    nodeOptions: [
        '--harmony',
        '--max_old_space_size=4096'
    ],
    workingDirectory: __dirname,
    wait: 2,
    grow: 0.25
});

// Listen for the install event
svc.on('install', function() {
    console.log('✅ Service installed successfully');
    console.log('🚀 Starting service...');
    svc.start();
});

svc.on('alreadyinstalled', function() {
    console.log('ℹ️ Service is already installed');
    console.log('🔄 Restarting service...');
    svc.restart();
});

svc.on('start', function() {
    console.log('🎉 Service started successfully');
    console.log('📋 Service is now running in background');
    console.log('🔍 Check Windows Services (services.msc) to see it');
});

svc.on('stop', function() {
    console.log('🛑 Service stopped');
});

svc.on('uninstall', function() {
    console.log('🗑️ Service uninstalled');
});

svc.on('error', function(err) {
    console.error('❌ Service error:', err);
});

// Install the service
console.log('🔧 Installing background service as Windows Service...');
svc.install();