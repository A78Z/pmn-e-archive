import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./lib/**/*.{js,ts,jsx,tsx,mdx}",
        "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                border: "var(--border)",
                input: "var(--input)",
                ring: "var(--ring)",
                background: "var(--color-background)",
                foreground: "var(--color-foreground)",
                primary: {
                    DEFAULT: "var(--color-primary)",
                    foreground: "var(--color-primary-foreground)",
                },
                secondary: {
                    DEFAULT: "var(--color-secondary)",
                    foreground: "var(--color-secondary-foreground)",
                },
                destructive: {
                    DEFAULT: "var(--color-destructive)",
                    foreground: "var(--color-destructive-foreground)",
                },
                muted: {
                    DEFAULT: "var(--color-muted)",
                    foreground: "var(--color-muted-foreground)",
                },
                accent: {
                    DEFAULT: "var(--color-accent)",
                    foreground: "var(--color-accent-foreground)",
                },
                popover: {
                    DEFAULT: "var(--color-popover)",
                    foreground: "var(--color-popover-foreground)",
                },
                card: {
                    DEFAULT: "var(--color-card)",
                    foreground: "var(--color-card-foreground)",
                },
                // Charte PMN
                pmn: {
                    ink: "var(--pmn-ink)",
                    "ink-strong": "var(--pmn-ink-strong)",
                    text2: "var(--pmn-text-2)",
                    subtle: "var(--pmn-subtle)",
                    faint: "var(--pmn-faint)",
                    faint2: "var(--pmn-faint-2)",
                    green: "var(--pmn-green)",
                    "green-dark": "var(--pmn-green-dark)",
                    "green-deep": "var(--pmn-green-deep)",
                    "green-light": "var(--pmn-green-light)",
                    gold: "var(--pmn-gold)",
                    "gold-dark": "var(--pmn-gold-dark)",
                    "gold-deep": "var(--pmn-gold-deep)",
                    hover: "var(--pmn-hover)",
                    online: "var(--pmn-online)",
                    pdf: "var(--pmn-pdf)",
                    doc: "var(--pmn-doc)",
                },
                // Chart colors
                chart: {
                    1: "var(--color-chart-1)",
                    2: "var(--color-chart-2)",
                    3: "var(--color-chart-3)",
                    4: "var(--color-chart-4)",
                    5: "var(--color-chart-5)",
                }
            },
            borderRadius: {
                lg: "var(--radius-lg)",
                md: "var(--radius-md)",
                sm: "var(--radius-sm)",
            },
            boxShadow: {
                soft: "var(--shadow-soft)",
                card: "var(--shadow-card)",
                cta: "var(--shadow-cta)",
                "card-hover": "var(--shadow-card-hover)",
            },
            fontFamily: {
                sans: ["var(--font-public-sans)", "system-ui", "sans-serif"],
                display: ["var(--font-spectral)", "Georgia", "serif"],
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
                "fade-up": {
                    from: { opacity: "0", transform: "translateY(8px)" },
                    to: { opacity: "1", transform: "none" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "fade-up": "fade-up 0.35s ease both",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};

export default config;
