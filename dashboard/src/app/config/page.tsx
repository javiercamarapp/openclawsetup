"use client";

import Link from "next/link";

export default function ConfigPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <header className="mb-6">
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-600">
          &larr; Back
        </Link>
        <h1 className="text-xl font-semibold">Config</h1>
        <p className="text-sm text-gray-500">
          Use the settings gear in the header to access configuration.
        </p>
      </header>
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        Click the <span className="font-mono">gear icon</span> in the header to open the configuration panel.
      </div>
    </main>
  );
}
