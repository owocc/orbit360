import { useEffect, useRef } from "react";

export function ExampleBar({ items, currentId, onSelect }) {
  const barRef = useRef(null);

  useEffect(() => {
    const active = barRef.current?.querySelector(".ex-pill.on");
    active?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [currentId, items]);

  if (!items || items.length < 2) return null;

  return (
    <div className="ex-bar" ref={barRef}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`ex-pill${item.id === currentId ? " on" : ""}`}
          onClick={() => onSelect(item)}
        >
          {item.title || item.id}
        </button>
      ))}
    </div>
  );
}
