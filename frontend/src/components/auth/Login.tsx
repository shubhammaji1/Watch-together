"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, User } from "lucide-react";

export default function Login() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const navigate = useNavigate();

  // ---------------- LOGIN ----------------
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const form = e.target as HTMLFormElement;
    const email = (form.email as any).value.trim();
    const password = (form.password as any).value.trim();

    if (!email || !password) {
      setErrorMsg("All fields are required");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    // 👉 Get full name from user metadata
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const fullName = user.user_metadata.full_name;
      localStorage.setItem("fullName", fullName);
    }

    navigate("/watch");
  }

  // ---------------- SIGNUP ----------------
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const form = e.target as HTMLFormElement;
    const name = (form.name as any).value.trim();
    const email = (form.email as any).value.trim();
    const password = (form.password as any).value.trim();

    if (!name || !email || !password) {
      setErrorMsg("All fields are required");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    alert("Account created! Please verify your email.");
    setIsFlipped(false);
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center min-h-screen 
      bg-gradient-to-br from-[#1b1b2f] via-[#162447] to-[#1f4068] p-6">

      <div className="relative w-[360px] h-[500px]">

        <div
          className={`relative w-full h-full transition-transform duration-700 preserve-3d ${
            isFlipped ? "rotate-y-180" : ""
          }`}
        >
          {/* LOGIN CARD */}
          <div className="absolute w-full h-full backface-hidden 
            bg-white/10 backdrop-blur-xl shadow-2xl rounded-3xl p-8 border border-white/20">

            <h2 className="text-3xl font-bold mb-6 text-center text-white">Login</h2>

            {errorMsg && <p className="text-red-300 text-center mb-3">{errorMsg}</p>}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm text-white font-semibold">Email</label>
                <div className="flex items-center gap-2 bg-white/20 p-3 rounded-xl border border-white/30">
                  <Mail size={18} className="text-white" />
                  <input
                    type="email"
                    name="email"
                    className="w-full text-white bg-transparent outline-none placeholder-white/60"
                    placeholder="example@gmail.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-white font-semibold">Password</label>
                <div className="flex items-center gap-2 bg-white/20 p-3 rounded-xl border border-white/30">
                  <Lock size={18} className="text-white" />
                  <input
                    type="password"
                    name="password"
                    className="w-full text-white bg-transparent outline-none placeholder-white/60"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl mt-4 bg-gradient-to-r 
                from-indigo-500 to-purple-500 text-white font-semibold shadow-lg hover:scale-[1.02] 
                transition-all duration-200"
              >
                {loading ? "Logging in..." : "Login"}
              </button>

              <p className="text-center text-sm mt-3 text-white/80">
                Don’t have an account?{" "}
                <button
                  type="button"
                  className="text-blue-300 underline"
                  onClick={() => setIsFlipped(true)}
                >
                  Sign Up
                </button>
              </p>
            </form>
          </div>

          {/* SIGNUP CARD */}
          <div className="absolute w-full h-full backface-hidden rotate-y-180
            bg-white/10 backdrop-blur-xl shadow-2xl rounded-3xl p-8 border border-white/20">

            <h2 className="text-3xl font-bold mb-6 text-center text-white">Create Account</h2>

            {errorMsg && <p className="text-red-300 text-center mb-3">{errorMsg}</p>}

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="text-sm text-white font-semibold">Full Name</label>
                <div className="flex items-center gap-2 bg-white/20 p-3 rounded-xl border border-white/30">
                  <User size={18} className="text-white" />
                  <input
                    type="text"
                    name="name"
                    placeholder="John Doe"
                    className="w-full text-white bg-transparent outline-none placeholder-white/60"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-white font-semibold">Email</label>
                <div className="flex items-center gap-2 bg-white/20 p-3 rounded-xl border border-white/30">
                  <Mail size={18} className="text-white" />
                  <input
                    type="email"
                    name="email"
                    className="w-full text-white bg-transparent outline-none placeholder-white/60"
                    placeholder="example@gmail.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-white font-semibold">Password</label>
                <div className="flex items-center gap-2 bg-white/20 p-3 rounded-xl border border-white/30">
                  <Lock size={18} className="text-white" />
                  <input
                    type="password"
                    name="password"
                    className="w-full text-white bg-transparent outline-none placeholder-white/60"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl mt-4 bg-gradient-to-r 
                from-purple-500 to-pink-500 text-white font-semibold shadow-lg hover:scale-[1.02] 
                transition-all duration-200"
              >
                {loading ? "Creating..." : "Sign Up"}
              </button>

              <p className="text-center text-sm mt-3 text-white/80">
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-blue-300 underline"
                  onClick={() => setIsFlipped(false)}
                >
                  Login
                </button>
              </p>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
