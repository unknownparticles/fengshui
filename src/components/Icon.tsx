export function Icon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const paths: Record<string, string> = {
    compass:
      "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm4 5-2.5 5.5L8 16l2.5-5.5L16 8Z",
    projects: "M3 7h7l2-3h9v16H3V7Zm0 4h18",
    knowledge:
      "M12 5v16M12 6C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2Z",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z",
    plus: "M12 5v14M5 12h14",
    arrow: "m9 5 7 7-7 7",
    download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
    sun: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2",
    check: "m4 12 5 5L20 6",
    pin: "M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13Zm0-17a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  };
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.compass} />
    </svg>
  );
}
