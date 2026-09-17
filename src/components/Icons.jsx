const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function Svg({ children, size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base} {...props}>
      {children}
    </svg>
  );
}

export const IconSearch = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </Svg>
);

export const IconBolt = (p) => (
  <Svg {...p}>
    <path d="M13 2 4.5 13.5H11L9.5 22 19.5 10H13L15 2Z" />
  </Svg>
);

export const IconChart = (p) => (
  <Svg {...p}>
    <line x1="4" y1="20" x2="20" y2="20" />
    <line x1="6" y1="20" x2="6" y2="15" />
    <line x1="11" y1="20" x2="11" y2="8" />
    <line x1="16" y1="20" x2="16" y2="4" />
  </Svg>
);

export const IconPrint = (p) => (
  <Svg {...p}>
    <path d="M6 9V3h12v6" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="7" rx="1" />
    <line x1="18" y1="11" x2="18" y2="11" />
  </Svg>
);

export const IconMoney = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v10M9.5 8.5c0-.3.5-1 2.5-1s2.5.7 2.5 1.4c0 1.1-2.5 1.4-2.5 2.8 0 .8.7 1.4 2.5 1.4 2 0 2.5-.7 2.5-1" />
  </Svg>
);

export const IconCalendar = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="3" x2="8" y2="7" />
    <line x1="16" y1="3" x2="16" y2="7" />
  </Svg>
);

export const IconRocket = (p) => (
  <Svg {...p}>
    <path d="M5 15c-1 1-1.5 4-1.5 4s3-.5 4-1.5M9.5 15.5 8.5 20s4-1 5.5-2.5c1.5-1.5 3-5 3-9-4 0-7.5 1.5-9 3C5.5 13.5 5.5 14.5 5.5 14.5s.5.5 1 1" />
    <path d="M15 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" fill="currentColor" />
  </Svg>
);

export const IconFire = (p) => (
  <Svg {...p}>
    <path d="M12 3c1 3-1 4.5-1 7 0 1.5 1 2.5 2.5 2.5 1.5 0 2.5-1 2.5-2.5 0-.8-.3-1.4-.8-2 .9 1 1.4 2 1.4 3A4.5 4.5 0 1 1 12 3Z" />
    <path d="M12 15c0 2 2 2.5 2 4 0 1-.9 2-2 2s-2-1-2-2c0-.8.5-1.4 1.3-1.6" />
  </Svg>
);

export const IconCheck = (p) => (
  <Svg {...p}>
    <path d="M4.5 12.5 10 18 19.5 6.5" />
  </Svg>
);

export const IconCheckCircle = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.5 2.5L16 9.5" />
  </Svg>
);

export const IconInbox = (p) => (
  <Svg {...p}>
    <path d="M4 13V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8" />
    <path d="M3 13h5a2 2 0 0 1 2 2 2 2 0 0 0 4 0 2 2 0 0 1 2-2h5" />
    <path d="M3 13v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
  </Svg>
);

export const IconStar = (p) => (
  <Svg {...p}>
    <path d="m12 3 2.7 5.9 6.3.7-4.7 4.3 1.3 6.1L12 17l-5.6 3-1.3-6.1L.4 9.6l6.3-.7L12 3Z" />
  </Svg>
);

export const IconLock = (p) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);

export const IconTrophy = (p) => (
  <Svg {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 14v3M9 21h6M10 17h4" />
  </Svg>
);

export const IconThumb = (p) => (
  <Svg {...p}>
    <path d="M7 11 12 3c1 0 2 1 2 2 0 .8-.5 1.5-1 2l-1 2h5.5c1 0 1.5 1 1.5 1L20 13c0 1-1 2-2 2h-1v4c0 1-1 2-2 2h-2.5c-.5 0-1-.3-1-1v-2l-.6-1.5L9 15H7V11" />
    <path d="M5 11h2v7H5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z" />
  </Svg>
);

export const IconTrendUp = (p) => (
  <Svg {...p}>
    <path d="m4 17 6-6 4 4 6-7" />
    <path d="M15 8h5v5" />
  </Svg>
);

export const IconTrendDown = (p) => (
  <Svg {...p}>
    <path d="m4 7 6 6 4-4 6 7" />
    <path d="M15 16h5v-5" />
  </Svg>
);

export const IconGauge = (p) => (
  <Svg {...p}>
    <path d="M5 19a9 9 0 1 1 14 0" />
    <path d="M12 14 15 9" />
  </Svg>
);

export const IconPencil = (p) => (
  <Svg {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
);

export const IconPlus = (p) => (
  <Svg {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export const IconClose = (p) => (
  <Svg {...p}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </Svg>
);

export const IconRotate = (p) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </Svg>
);