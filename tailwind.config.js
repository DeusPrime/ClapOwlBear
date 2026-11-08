import animate from "tailwindcss-animate";
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "./vendor/clap-site/src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      fontFamily: {
        mono: ["Courier Prime", "Courier New", "monospace"],
        display: ["Anton", "Impact", "sans-serif"],
        type: ["Special Elite", "Courier Prime", "monospace"],
      },
      colors: Object.fromEntries(
        [
          "background",
          "foreground",
          "paper",
          "paper-dark",
          "ink",
          "border",
          "input",
          "ring",
          "corps",
          "esprit",
          "ame",
        ]
          .map((name) => [name, `hsl(var(--${name}))`])
          .concat(
            [
              "card",
              "popover",
              "primary",
              "secondary",
              "muted",
              "accent",
              "destructive",
            ].map((name) => [
              name,
              {
                DEFAULT: `hsl(var(--${name}))`,
                foreground: `hsl(var(--${name}-foreground))`,
              },
            ]),
          ),
      ),
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down .2s ease-out",
        "accordion-up": "accordion-up .2s ease-out",
      },
    },
  },
  plugins: [animate],
};
