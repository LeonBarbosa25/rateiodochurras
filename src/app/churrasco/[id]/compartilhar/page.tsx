import { notFound } from 'next/navigation';
import { getBarbecue, listParticipants, computeBarbecueSummary } from '@/lib/queries';
import { formatBRL } from '@/lib/money';
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
        <p className="text-xs text-coal-700 mb-3">Quem abrir este link vê dados do evento e a lista de despesas — sem valores individuais.</p>
        <CopyButton path={`/c/${b.share_token}`} label="Copiar link geral" />
      </div>

      <div className="card">
        <h2 className="font-bold mb-3">Links individuais</h2>
        <p className="text-xs text-coal-700 mb-3">Cada participante tem um link único onde vê quanto deve pagar.</p>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Participante</th><th className="text-right">A pagar</th><th>Mensagem pronta</th><th>Link</th></tr></thead>
            <tbody>
              {participants.map((p) => {
                const r = rowsById.get(p.id);
                const due = r?.balanceCents ?? 0;
                const msg = mensagemCobranca({ nome: p.name, churrasco: b.name, data: b.event_date || '', pix: b.pix_key || '', valor: formatBRL(Math.max(0, due)) });
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="text-right money">{formatBRL(due)}</td>
                    <td><CopyButton text={msg} label="Copiar mensagem" small /></td>
                    <td><CopyButton path={`/p/${p.access_token}`} label="Copiar link" small /></td>
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

function mensagemCobranca({ nome, churrasco, data, pix, valor }: { nome: string; churrasco: string; data: string; pix: string; valor: string }) {
  return [
    `Olá, ${nome}! O rateio do ${churrasco} foi calculado.`,
    ``,
    `Valor a pagar: ${valor}`,
    data ? `Data do churrasco: ${data}` : ``,
    pix ? `Pix: ${pix}` : ``,
    ``,
    `Consulte os detalhes no seu link individual.`,
  ].filter(Boolean).join('\n');
}
