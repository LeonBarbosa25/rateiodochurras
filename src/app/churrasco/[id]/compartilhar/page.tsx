import { notFound } from 'next/navigation';
import { getBarbecue, listParticipants, computeBarbecueSummary } from '@/lib/queries';
import { formatBRL } from '@/lib/money';
import { formatDateBR } from '@/lib/date';
import CopyButton from './CopyButton';

export default async function CompartilharPage({ params }: { params: { id: string } }) {
  const b = await getBarbecue(params.id);
  if (!b) notFound();
  const [participants, summary] = await Promise.all([
    listParticipants(b.id),
    computeBarbecueSummary(b.id),
  ]);
  const rowsById = new Map(summary.rows.map((r) => [r.participant.id, r]));

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="font-bold mb-3">Link geral do churrasco</h2>
        <p className="text-xs text-coal-700 mb-3">Quem abrir este link vê dados do evento, participantes e pode entrar no ambiente individual pelo próprio nome.</p>
        <CopyButton path={`/c/${b.share_token}`} label="Copiar link geral" />
      </div>

      <div className="card">
        <h2 className="font-bold mb-3">Links individuais</h2>
        <p className="text-xs text-coal-700 mb-3">Cada participante tem um link único onde vê quanto deve pagar.</p>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Participante</th><th className="text-right">A pagar</th><th>WhatsApp</th><th>Mensagem + link</th></tr></thead>
            <tbody>
              {participants.map((p) => {
                const r = rowsById.get(p.id);
                const due = r?.balanceCents ?? 0;
                const msg = mensagemCobranca({ nome: p.name, churrasco: b.name, data: b.event_date ? formatDateBR(b.event_date) : '', pix: b.pix_key || '', valor: formatBRL(Math.max(0, due)), path: `/p/${p.access_token}` });
                const phone = normalizeWhatsAppPhone(p.phone);
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rateiodochurras.vercel.app';
                const whatsapp = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg.replace('[LINK]', siteUrl))}` : '';
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="text-right money">{formatBRL(due)}</td>
                    <td>{whatsapp ? <a className="text-ember-700 hover:underline text-xs" href={whatsapp} target="_blank">Enviar</a> : <span className="text-xs text-coal-700">Sem WhatsApp</span>}</td>
                    <td><CopyButton text={msg} label="Copiar tudo" small /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function normalizeWhatsAppPhone(phone: string | null): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function mensagemCobranca({ nome, churrasco, data, pix, valor, path }: { nome: string; churrasco: string; data: string; pix: string; valor: string; path: string }) {
  return [
    `Olá, ${nome}! O rateio do ${churrasco} foi calculado.`,
    ``,
    `Valor a pagar: ${valor}`,
    data ? `Data do churrasco: ${data}` : ``,
    pix ? `Pix: ${pix}` : ``,
    ``,
    `Consulte os detalhes e informe o pagamento: [LINK]${path}`,
  ].filter(Boolean).join('\n');
}
