// components/Navbar.tsx
import React from "react";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

export const Navbar = () => {
  return (
    <nav className="flex justify-between items-center p-4 border-b">
      <Link to="/" className="font-bold text-xl">Adapt</Link>

      <div className="flex space-x-4">
        <SignedIn>
          <Link to="/dashboard" className="hover:underline">Dashboard</Link>
          <Link to="/upload" className="hover:underline">Upload</Link>
        </SignedIn>

        <SignedOut>
          <SignInButton><button className="text-blue-600 hover:underline">Sign In</button></SignInButton>
          <SignUpButton><button className="text-blue-600 hover:underline">Sign Up</button></SignUpButton>
        </SignedOut>
      </div>
    </nav>
  );
};
