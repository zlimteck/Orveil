import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('nh_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setUser(r.data))
      .catch(() => { setToken(null); localStorage.removeItem('nh_token'); })
      .finally(() => setLoading(false));
  }, [token]);

  function login(tok, username) {
    localStorage.setItem('nh_token', tok);
    setToken(tok);
    setUser({ username });
  }

  function logout() {
    localStorage.removeItem('nh_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
