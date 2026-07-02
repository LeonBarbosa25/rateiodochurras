'use client';

import { useTransition } from 'react';

export default function ConfirmDelete({
  formAction,
  label = 'Excluir',
  message = 'Tem certeza que deseja excluir?',
  className = 'btn-ghost text-red-700',
  children,
}: {
  formAction: (formData: FormData) => void | Promise<void>;
  label?: string;
  message?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirm(message)) {
      const formData = new FormData(event.currentTarget);
      startTransition(() => {
        void formAction(formData);
      });
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {children}
      <button className={className} type="submit" disabled={pending}>
        {pending ? '⏳ Excluindo...' : label}
      </button>
    </form>
  );
}
