import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

const Login = ({ setToken }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', { username, password });
      setToken(res.data.token);
      navigate('/products');
    } catch (err) {
      alert('Login failed');
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md">
        <h2 className="text-2xl mb-4">Login</h2>
        <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="block w-full mb-2 p-2 border" />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full mb-2 p-2 border" />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2">Login</button>
        <Link to="/register" className="block mt-2 text-blue-500">Register</Link>
      </form>
    </div>
  );
};

export default Login;