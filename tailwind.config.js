/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep Dark Theme System (CSS Variable Mappings)
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',

        // Legacy/Transition Mappings
        'primary-bg': 'var(--background)',
        'secondary-bg': 'var(--secondary)',
        'card-bg': 'var(--card)',
        'app-border': 'var(--border)',

        // Chart colors
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },

        // Sidebar colors
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },

        // Service Hub surfaces
        'surface-dark': 'var(--surface-dark)',
        'surface-card': 'var(--surface-card)',
        'surface-elevated': 'var(--surface-elevated)',

        // Gradient Anchors
        'heading-from': 'var(--heading-gradient-from)',
        'heading-to': 'var(--heading-gradient-to)',
        'btn-from': 'var(--btn-gradient-from)',
        'btn-via': 'var(--btn-gradient-via)',
        'btn-to': 'var(--btn-gradient-to)',

        // Tags
        tag: {
          free: 'var(--tag-free)',
          popular: 'var(--tag-popular)',
          trending: 'var(--tag-trending)',
          new: 'var(--tag-new)',
          recommended: 'var(--tag-recommended)',
        },

        // Stats
        stat: {
          green: 'var(--stat-green)',
          blue: 'var(--stat-blue)',
          amber: 'var(--stat-amber)',
        },

        // Legacy Navy (keeping for compatibility during transition)
        navy: {
          800: '#0a192f',
          900: '#020c1b',
          950: '#01060f',
        },

        // Glass Utilities
        glass: {
          100: 'rgba(255, 255, 255, 0.03)',
          200: 'rgba(255, 255, 255, 0.08)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-in': 'slideIn 0.3s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      }
    },
  },
  plugins: [],
}