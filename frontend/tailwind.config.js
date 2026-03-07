/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#050505",
                surface: "#111111",
                surfaceHover: "#1A1A1A",
                border: "#222222",
                primary: "#FFFFFF",
                primaryHover: "#E0E0E0",
                secondary: "#A1A1AA",
            },
            fontFamily: {
                sans: ['Inter', 'San Francisco', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
