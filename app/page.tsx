'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [clicked, setClicked] = useState(false);

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="w-full max-w-md text-center">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Test website
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Hello, world.</h1>
        <p className="mx-auto mt-4 max-w-sm text-base leading-7 text-muted-foreground">
          This is the simplest possible website. If you can see this, it works.
        </p>
        <Button className="mt-8 h-11 rounded-full px-6 text-base" onClick={() => setClicked(true)}>
          Test the button
        </Button>
        <p className="mt-4 min-h-6 text-sm font-medium text-primary" aria-live="polite">
          {clicked ? 'It works ✓' : ''}
        </p>
      </section>
    </main>
  );
}
