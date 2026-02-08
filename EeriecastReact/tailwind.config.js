/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['"DM Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
  			display: ['"Outfit"', 'system-ui', 'sans-serif'],
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			// Eeriecast custom colors
  			eeriecast: {
  				crimson: '#DC2626',
  				blood: '#991B1B',
  				'deep-red': '#7F1D1D',
  				violet: '#7C3AED',
  				'deep-violet': '#4C1D95',
  				surface: '#0A0A12',
  				'surface-light': '#111118',
  				'surface-lighter': '#18181F',
  			},
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			},
  			'fade-in': {
  				from: { opacity: '0', transform: 'translateY(8px)' },
  				to: { opacity: '1', transform: 'translateY(0)' }
  			},
  			'fade-in-up': {
  				from: { opacity: '0', transform: 'translateY(16px)' },
  				to: { opacity: '1', transform: 'translateY(0)' }
  			},
  			'slide-in-right': {
  				from: { opacity: '0', transform: 'translateX(20px)' },
  				to: { opacity: '1', transform: 'translateX(0)' }
  			},
  			'glow-pulse': {
  				'0%, 100%': { boxShadow: '0 0 20px rgba(220, 38, 38, 0)' },
  				'50%': { boxShadow: '0 0 20px rgba(220, 38, 38, 0.2)' }
  			},
			'float': {
				'0%, 100%': { transform: 'translateY(0px)' },
				'50%': { transform: 'translateY(-6px)' }
			},
			'heart-bloom': {
				'0%':   { transform: 'scale(0.7)', opacity: '0.4' },
				'45%':  { transform: 'scale(1.18)', opacity: '1' },
				'72%':  { transform: 'scale(0.96)', opacity: '1' },
				'100%': { transform: 'scale(1)', opacity: '1' },
			},
			'follow-glow': {
				'0%':   { boxShadow: '0 0 0 0 rgba(248, 113, 113, 0.4), inset 0 0 0 0 rgba(248, 113, 113, 0)' },
				'40%':  { boxShadow: '0 0 18px 4px rgba(248, 113, 113, 0.12), inset 0 0 12px 0 rgba(248, 113, 113, 0.06)' },
				'100%': { boxShadow: '0 0 0 0 rgba(248, 113, 113, 0), inset 0 0 0 0 rgba(248, 113, 113, 0)' },
			},
			'follow-ring': {
				'0%':   { transform: 'scale(1)', opacity: '0.6' },
				'100%': { transform: 'scale(1.45)', opacity: '0' },
			},
			'heart-release': {
				'0%':   { transform: 'scale(1)', opacity: '1' },
				'25%':  { transform: 'scale(1.08)', opacity: '1' },
				'55%':  { transform: 'scale(0.82)', opacity: '0.5' },
				'80%':  { transform: 'scale(1.03)', opacity: '0.9' },
				'100%': { transform: 'scale(1)', opacity: '1' },
			},
			'unfollow-dim': {
				'0%':   { opacity: '1' },
				'35%':  { opacity: '0.55' },
				'100%': { opacity: '1' },
			},
		},
		animation: {
			'accordion-down': 'accordion-down 0.2s ease-out',
			'accordion-up': 'accordion-up 0.2s ease-out',
			'fade-in': 'fade-in 0.5s ease-out',
			'fade-in-up': 'fade-in-up 0.6s ease-out',
			'slide-in-right': 'slide-in-right 0.4s ease-out',
			'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
			'float': 'float 6s ease-in-out infinite',
			'heart-bloom': 'heart-bloom 0.65s cubic-bezier(0.22, 1, 0.36, 1)',
			'follow-glow': 'follow-glow 0.85s ease-out',
			'follow-ring': 'follow-ring 0.7s cubic-bezier(0, 0.55, 0.45, 1) forwards',
			'heart-release': 'heart-release 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
			'unfollow-dim': 'unfollow-dim 0.5s ease-in-out',
		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
