// One source of truth for the product name and the public contact details.
// Every screen, every email and every legal page reads from here, so a rename
// is a single edit instead of a hunt through the tree.

export const BRAND = {
  name: "Paceline",
  founder: "Tchizu",
  tagline: "Set goals. Stay on pace.",
  label: "Monthly goal tracker",
  // Edit this to the inbox that should receive support mail.
  supportEmail: "support@paceline.app",
  year: 2026,
};

// The founder story on the landing page is a placeholder until the real one
// is written. Edit FOUNDER_STORY and FOUNDER_TIMELINE in src/pages/Landing.jsx.
export const LEGAL_PAGES = [
  {
    id: "privacy",
    title: "Privacy",
    intro: "What Paceline stores about you, and what it never touches.",
    sections: [
      {
        heading: "What we store",
        body: "Your name, email address, phone number, the goals you set, the progress you log and the streak you build. Your goals are yours: nobody else can open them.",
      },
      {
        heading: "What other members can see",
        body: "The leaderboard shows your first name, your last initial and your streak. That is the whole of it. Your goal names, your numbers and your notes stay private.",
      },
      {
        heading: "Your data, your call",
        body: "Delete your account from Settings and everything attached to it goes with it: goals, progress, streak and notes. There is no soft delete waiting in a queue.",
      },
    ],
  },
  {
    id: "terms",
    title: "Terms",
    intro: "The short version of what you can expect from us, and what we expect from you.",
    sections: [
      {
        heading: "What Paceline is",
        body: "A monthly goal tracker. You set goals, you log what you did, and the app tells you whether you are on pace. It is a tool for your own month, not a service that promises you results.",
      },
      {
        heading: "Your account",
        body: "One account per person. Keep your password to yourself, and tell us if you think someone else is using it.",
      },
      {
        heading: "Fair use",
        body: "Do not use Paceline to store or share anything unlawful, and do not try to break the service. We may close accounts that do.",
      },
    ],
  },
  {
    id: "refunds",
    title: "Refunds",
    intro: "What happens to your money if you change your mind.",
    sections: [
      {
        heading: "Free trial",
        body: "The trial is free and needs no card. Nothing is charged when it ends.",
      },
      {
        heading: "Paid plans",
        body: "Cancel any time from Settings. We refund a plan you bought and then cancelled within 30 days, no questions asked.",
      },
      {
        heading: "How long a refund takes",
        body: "We process refunds within 5 working days, back to the card you paid with.",
      },
    ],
  },
  {
    id: "cookies",
    title: "Cookies",
    intro: "The cookies Paceline sets, and the one that waits for your answer.",
    sections: [
      {
        heading: "What is always on",
        body: "A session cookie that keeps you logged in, and a preference cookie that remembers your cookie-banner choice. Without these the site cannot remember who you are.",
      },
      {
        heading: "Analytics",
        body: "Analytics cookies tell us which pages get used so we can fix the broken ones. They load only if you accept them, and declining changes nothing about how the tracker works.",
      },
      {
        heading: "Changing your mind",
        body: "Clear your browser storage for this site and the banner will ask you again.",
      },
    ],
  },
];

export const legalPage = (id) => LEGAL_PAGES.find((p) => p.id === id) || null;
