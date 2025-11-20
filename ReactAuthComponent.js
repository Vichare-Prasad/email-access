import React, { useState, useEffect } from 'react';
import './AuthComponent.css';

const ReactAuthComponent = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [emailConfig, setEmailConfig] = useState({
    emailProvider: 'gmail',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    email: '',
    appPassword: ''
  });
  const [statements, setStatements] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      validateToken(token);
    }
  }, []);

  const validateToken = async (token) => {
    try {
      const response = await fetch('http://localhost:3001/api/statements', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsLoggedIn(true);
        setStatements(data.statements);
      } else {
        localStorage.removeItem('authToken');
      }
    } catch (error) {
      console.error('Token validation failed:', error);
    }
  };

  const handleLogin = async (email, password) => {
    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('authToken', data.token);
        setIsLoggedIn(true);
        setUser({ email, userId: data.userId });
      } else {
        alert('Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleRegister = async (email, password) => {
    try {
      const response = await fetch('http://localhost:3001/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('authToken', data.token);
        setIsLoggedIn(true);
        setUser({ email, userId: data.userId });
      } else {
        alert('Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
    }
  };

  const handleEmailConfig = async () => {
    const token = localStorage.getItem('authToken');
    
    try {
      const response = await fetch('http://localhost:3001/api/email-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(emailConfig)
      });

      if (response.ok) {
        alert('Email configuration saved! Background service started.');
      } else {
        alert('Failed to save email configuration');
      }
    } catch (error) {
      console.error('Configuration error:', error);
    }
  };

  if (!isLoggedIn) {
    return <AuthForm onLogin={handleLogin} onRegister={handleRegister} />;
  }

  return (
    <div className="auth-container">
      <h2>Bank Statement Analyzer</h2>
      <div className="email-config">
        <h3>Email Configuration</h3>
        <input
          type="email"
          placeholder="Your email"
          value={emailConfig.email}
          onChange={(e) => setEmailConfig({...emailConfig, email: e.target.value})}
        />
        <input
          type="password"
          placeholder="App Password"
          value={emailConfig.appPassword}
          onChange={(e) => setEmailConfig({...emailConfig, appPassword: e.target.value})}
        />
        <select
          value={emailConfig.emailProvider}
          onChange={(e) => setEmailConfig({...emailConfig, emailProvider: e.target.value})}
        >
          <option value="gmail">Gmail</option>
          <option value="outlook">Outlook</option>
          <option value="yahoo">Yahoo</option>
          <option value="custom">Custom</option>
        </select>
        <button onClick={handleEmailConfig}>Save Configuration</button>
      </div>
      
      <div className="statements-list">
        <h3>Processed Statements</h3>
        {statements.map((statement, index) => (
          <div key={index} className="statement-item">
            {/* Display statement data */}
          </div>
        ))}
      </div>
    </div>
  );
};

const AuthForm = ({ onLogin, onRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) {
      onLogin(email, password);
    } else {
      onRegister(email, password);
    }
  };

  return (
    <div className="auth-form">
      <h2>{isLogin ? 'Login' : 'Register'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">{isLogin ? 'Login' : 'Register'}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
      </button>
    </div>
  );
};

export default ReactAuthComponent;