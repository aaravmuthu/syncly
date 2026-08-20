# Remix of Syncly

# System Prompt: Build "Gradeway" - A Premium HAC Dashboard & GPA Calculator

You are an expert frontend developer and UI/UX designer. Your task is to build "Gradeway", an ultra-premium, highly interactive dashboard application designed as a modern replacement wrapper interface for Home Access Center (HAC). The app must feel elite, smooth, and incredibly precise.

## 1. Aesthetic & UI/UX Direction

*   **Theme:** High-contrast dark mode by default. Use deep obsidian backgrounds (#0B0F19) with vibrant, neon accent glows (e.g., electric cyan, hyper-purple, and emerald green for positive grade trends).

*   **Visual Style:** "Liquid glass" / Glassmorphic card design. Use subtle backdrops blurs, fine borders (1px solid rgba(255,255,255,0.08)), and interactive gradient glow effects that follow the user's mouse cursor.

*   **Typography:** Ultra-clean, modern sans-serif (like Inter or SF Pro). Sharp visual hierarchies with bold, scannable grade badges.

*   **Animations:** Smooth, spring-based micro-interactions. Class cards should slightly lift on hover, dropdowns should glide open, and GPA progress rings must animate seamlessly on load.

## 2. Core App Structure & Screens

### A. Main Dashboard Overview

*   **Hero Section:** Displays the student's **Current Cumulative GPA** (Large, animated circular progress ring or high-end gradient text), Class Rank, and Total Credits.

*   **Quick Stats Grid:** High-fidelity micro-cards showing:

    *   *Next Class:* Room number, current grade, and time.

    *   *Alerts:* Number of missing assignments or recent grade drops.

    *   *Daily Trend:* A miniature sparkline chart showing grade fluctuations over the last 7 days.

*   **Active Classes Grid:** Expandable "liquid glass" cards for each current course. 

    *   Each card shows: Course Name, Teacher, Current Numeric Grade (e.g., 97%), and a letter grade badge.

    *   Clicking a card smoothly expands it to reveal a breakdown of assignment categories (e.g., Summative 60%, Formative 40%) and a list of individual assignments.

### B. "Perfect" GPA Simulator & Calculator

To ensure absolute mathematical perfection, build a dedicated interactive calculator tab:

*   **Dual Mode:** Toggle seamlessly between **Unweighted (4.0 Scale)** and **Weighted (5.0/6.0 Advanced Scales)**.

*   **Course Tier Selector:** Every class row must have a dropdown to select its weight tier (e.g., Regular/Academic, Honors/Pre-AP, AP/IB) so the calculator applies the exact correct point weight.

*   **"What-If" Simulator:** 

    *   Users can adjust sliders or type in hypothetical grades for future assignments or upcoming finals.

    *   The app must instantly recalculate the class average based on the category weights and show the real-time impact on both the semester GPA and overall Cumulative GPA.

*   **Logic Rule:** Ensure the math accounts for credit hours (e.g., a 0.5 credit semester course vs. a 1.0 credit full-year course).

### C. Premium Interactive Transcript

*   **Timeline View:** A gorgeous, vertical chronological timeline tracking academic history semester-by-semester (e.g., Freshman Year - Semester 1, Semester 2).

*   **Data Organization:** Each past semester module displays a clean table of final grades, credits earned, and the calculated GPA for that specific term.

*   **Performance Charting:** An interactive line or area chart at the top of the transcript page mapping the user’s GPA trajectory over time. Hovering over data points highlights key achievements.

## 3. Features & Functionality

*   **Mock Data Sync:** Provide a beautifully styled "Sync HAC Account" login modal. Since this is a frontend prototype, clicking "Connect" should run a sleek loading animation and populate the app with rich, highly realistic student data (multiple courses, AP/Honors tiers, varied assignment scores).

*   **Search & Filter:** A global command-bar style search (Cmd+K) or search input to quickly filter assignments by name, category, or status (e.g., typing "missing" brings up all missing work across all classes).

*   **Theme Picker:** Allow users to switch between the default "Obsidian Glow", a sleek "Monochrome Slate", and a high-contrast "Matrix Green" aesthetic.

## 4. Technical Deliverables

*   Write exceptionally clean, modular components.

*   Use robust state management to ensure that whenever a grade is tweaked in the simulator, the updates cascade perfectly across the dashboard and transcript screens without latency.

*   Prioritize scannability—information should be readable at a glance without cluttering the premium aesthetic.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e664bf8d-17c6-44c4-bee6-727f47b6cbe0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
