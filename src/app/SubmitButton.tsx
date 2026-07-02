'use client';

import { useFormStatus } from 'react-dom';

export default function SubmitButton({
  children,
  label = 'Salvar',
  className = 'btn-primary',
}: {
  children?: React.ReactNode;
  label?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending}>
      {pending ? '⏳ Salvando...' : (children ?? label)}
    </button>
  );
}
