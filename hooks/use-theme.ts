// Simple theme hook for sonner toasts
// Since we're using a dark theme by default, we'll just return 'dark'
export function useTheme() {
  return { theme: 'dark' as const }
}
