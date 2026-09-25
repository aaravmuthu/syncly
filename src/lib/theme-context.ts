import { createContext, useContext } from "react";

export type ThemeChoice = "light" | "dark" | "system";

export type Ctx = {
  theme: ThemeChoice;
  resolved: "light" | "dark";
  setTheme: (t: ThemeChoice) => void;
  toggle: () => void;
};

export const ThemeContext = createContext<Ctx>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}
