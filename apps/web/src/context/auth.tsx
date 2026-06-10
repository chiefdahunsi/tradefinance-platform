"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "SME_OWNER" | "ANALYST" | "ADMIN";
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User>;
  analystLogin: (email: string, password: string) => Promise<User>;
  register: (data: RegisterData) => Promise<User>;
  logout: () => void;
  loading: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tf_token");
      const storedUser = localStorage.getItem("tf_user");
      if (stored && storedUser) {
        setToken(stored);
        setUser(JSON.parse(storedUser));
      }
    } catch {}
    setLoading(false);
  }, []);


  const login = async (email: string, password: string): Promise<User> => {
    const { data } = await api.post("/api/auth/login", { email, password });
    const { user, token } = data.data;
    localStorage.setItem("tf_token", token);
    localStorage.setItem("tf_user", JSON.stringify(user));
    setUser(user);
    setToken(token);
    return user;
  };

  const analystLogin = async (email: string, password: string): Promise<User> => {
    const { data } = await api.post("/api/auth/analyst-login", { email, password });
    const { user, token } = data.data;
    localStorage.setItem("tf_token", token);
    localStorage.setItem("tf_user", JSON.stringify(user));
    setUser(user);
    setToken(token);
    return user;
  };

  const register = async (formData: RegisterData): Promise<User> => {
    const { data } = await api.post("/api/auth/register", formData);
    const { user, token } = data.data;
    localStorage.setItem("tf_token", token);
    localStorage.setItem("tf_user", JSON.stringify(user));
    setUser(user);
    setToken(token);
    return user;
  };

  const logout = () => {
    localStorage.removeItem("tf_token");
    localStorage.removeItem("tf_user");
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, analystLogin, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
