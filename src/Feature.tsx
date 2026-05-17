import { useState } from "react";
import {
  useEventLog,
  useFairRng,
  useNamedPeer,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };
type Fortune = { id: string; peerId: string; text: string; ts: number };
type Draw = { round: number; fortuneId: string; peerId: string; ts: number };

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="fortune-screen">
        <h1>{config.appName}</h1>
        <p className="fortune-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, nameOf } = useNamedPeer(config, room);
  const fortunes = useEventLog<Fortune>(room, "fortunes");
  const draws = useEventLog<Draw>(room, "drawn");
  const fairRng = useFairRng(room, "fortune-salts");
  const [draft, setDraft] = useState("");

  const stateMap = room.doc.getMap<number>("state");
  const roundN = stateMap.get("round") ?? 0;

  const trimmedName = name.trim();
  const trimmedDraft = draft.trim();

  const ids = fortunes.events.map((f) => f.id);
  const shuffled = fairRng.shuffle(ids);
  const pickedId = shuffled.length > 0 ? shuffled[roundN % shuffled.length] : null;
  const picked = pickedId ? (fortunes.events.find((f) => f.id === pickedId) ?? null) : null;

  const addFortune = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedName || !trimmedDraft) return;
    fortunes.push({
      id: Math.random().toString(36).slice(2, 12),
      peerId: room.peerId,
      text: trimmedDraft,
      ts: Date.now(),
    });
    setDraft("");
  };

  const crack = () => {
    if (fortunes.size === 0) return;
    const next = roundN + 1;
    stateMap.set("round", next);
    const nextShuffle = fairRng.shuffle(ids);
    const nextId = nextShuffle[next % nextShuffle.length];
    if (nextId) {
      draws.push({ round: next, fortuneId: nextId, peerId: room.peerId, ts: Date.now() });
    }
  };

  return (
    <div className="fortune-screen">
      <header className="fortune-header">
        <h1>{config.appName}</h1>
        <p className="fortune-status">
          {fortunes.size} in pool · round {roundN}
        </p>
      </header>

      <input
        className="fortune-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="your name"
        maxLength={48}
        aria-label="your name"
      />

      <form className="fortune-form" onSubmit={addFortune}>
        <textarea
          className="fortune-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="add a fortune…"
          maxLength={140}
          rows={2}
        />
        <button
          type="submit"
          className="fortune-add"
          aria-label="add fortune"
          disabled={!trimmedName || !trimmedDraft}
        >
          add fortune
        </button>
      </form>

      <div className="fortune-card">
        {picked ? (
          <>
            <p className="fortune-card-text">{picked.text}</p>
            <p className="fortune-card-author">— {nameOf(picked.peerId)}</p>
          </>
        ) : (
          <p className="fortune-card-empty">no fortune drawn yet</p>
        )}
      </div>

      <button
        type="button"
        className="fortune-draw"
        aria-label="crack a cookie"
        onClick={crack}
        disabled={fortunes.size === 0}
      >
        crack a cookie
      </button>

      <ul className="fortune-pool">
        {fortunes.events.map((f) => (
          <li key={f.id} className="fortune-chip">
            {f.text} · {nameOf(f.peerId)}
          </li>
        ))}
      </ul>

      <ol className="fortune-history">
        {draws.latest(10).map((d, i) => {
          const f = fortunes.events.find((x) => x.id === d.fortuneId);
          return (
            <li key={`${d.round}-${i}`}>
              #{d.round} {f ? f.text : "(gone)"} → {nameOf(d.peerId)}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
