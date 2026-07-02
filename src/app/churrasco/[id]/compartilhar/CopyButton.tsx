'use client';

import { useState } from 'react';

export default function CopyButton({
  path,
  text,
  label,
  small,
}: {
  path?: string;
  text?: string;
  label: string;
  small?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function onClick() {
    const content = path ? `${window.location.origin}${path}` : (text || '').replaceAll('[LINK]', window.location.origin);
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copie manualmente:', content);
    }
  }
  return (
    <button onClick={onClick} className={`${small ? 'pill bg-coal-100 hover:bg-ember-100' : 'btn-secondary'}`}>
      {copied ? '✓ Copiado' : label}
    </button>
  );
}
