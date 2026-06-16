# yorocobu LLC Website

A modern, professional 3-page website for yorocobu LLC - an app development company building applications for underserved markets.

## 🚀 Overview

yorocobu LLC is preparing for investor fundraising and portfolio launch in Q3 2026. This website showcases our mission, technology stack, and team while providing a professional online presence for credibility and investor outreach.

**Company Name:** yorocobu LLC
**Meaning:** "To have joy" in Japanese
**Founders:** Ethan Gailushas and Bence Burton
**Focus:** React, Swift, Flutter, and major platforms

## 📱 Website Structure

### Page 1: Home
- **Hero Section** - Full-screen hero with company logo, name, and tagline
- **Mission Section** - Clear statement of our mission to fill market gaps
- **About the Name** - Story behind "Yorocobu" and our commitment to joy
- **Call to Action** - Links to other pages

### Page 2: Tech & Portfolio
- **Tech Stack** - Visual showcase of primary technologies (React, Swift, Flutter)
- **Additional Technologies** - Grid of supporting tech and tools
- **Portfolio** - Placeholder for Q3 2026 app launches

### Page 3: Contact & Investors
- **Investor Interest** - Information for strategic investors
- **Founders** - Team profiles with photo placeholders
- **Contact** - Email and social media placeholders

## 🛠️ Tech Stack

This website is built with:
- **React** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **CSS3** - Modern styling with custom properties
- **Inter Font** - Clean, modern typography

## 📦 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```
The site will be available at `http://localhost:5173`

### Build for Production
```bash
npm run build
```
Production files will be generated in the `dist/` directory.

### Preview Production Build
```bash
npm run preview
```

## 🚀 Deployment

### Deploy to Netlify

1. **Connect to Git:**
   - Push your code to GitHub
   - Go to [Netlify](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository

2. **Build Settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Click "Deploy site"

3. **Custom Domain (Optional):**
   - Go to Site settings → Domain management
   - Add your custom domain

### Deploy to Vercel

1. **Connect to Git:**
   - Push your code to GitHub
   - Go to [Vercel](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure:**
   - Framework Preset: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
   - Click "Deploy"

3. **Custom Domain (Optional):**
   - Go to Project Settings → Domains
   - Add your custom domain

## 🎨 Customization Guide

### Update Company Logo
Replace the placeholder logo in these locations:
- `src/components/Navigation.jsx` - Line 28 (logo-placeholder div)
- `src/pages/Home.jsx` - Line 11 (hero-logo-large)
- Add logo image to `public/` folder
- Update `index.html` favicon

### Update Contact Email
Email has been updated to `yorocobu.llc@gmail.com` in:
- `src/pages/Contact.jsx` - Lines 74 and 147

### Update Founder Photos
Replace founder placeholders in:
- `src/pages/Contact.jsx` - Lines 69-77 (founder-image-placeholder)
- Add actual photos to `public/images/` folder
- Update the component to use `<img>` tags

### Update Social Links
Replace placeholder links in:
- `src/pages/Contact.jsx` - Lines 19-23
- Change `url: '#'` to actual social media URLs
- Remove `placeholder: true` when links are active

### Update Portfolio Screenshots
Replace app placeholders when apps launch:
- `src/pages/TechPortfolio.jsx` - Lines 30-35
- Add screenshots to `public/images/apps/`
- Update the portfolio grid with real app data

### Color Scheme
The color palette is defined in `src/index.css` using CSS variables:
```css
--primary: #1e40af;      /* Deep blue */
--accent: #06b6d4;       /* Bright cyan */
```
Update these variables to change the entire site's color scheme.

## 📝 Design Features

- **Modern & Clean** - Inspired by Stripe, Linear, and Vercel
- **Fully Responsive** - Mobile-first design
- **Fast Loading** - Optimized with Vite
- **Smooth Animations** - Fade-in effects and transitions
- **Sticky Navigation** - Always accessible menu
- **Professional Typography** - Inter font family
- **Gradient Backgrounds** - Modern visual effects
- **Card-based Layout** - Clean, organized content

## 🎯 Key Features

✅ Three-page structure with smooth routing
✅ Sticky navigation with mobile menu
✅ Full-screen hero section
✅ Visual tech stack showcase
✅ Portfolio section with placeholders
✅ Founder profiles with placeholders
✅ Investor-focused messaging
✅ Contact information and social links
✅ Fully responsive design
✅ Production-ready build
✅ Easy to deploy
✅ Simple to customize

## 📂 Project Structure

```
yorocobu-website/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable components
│   │   ├── Navigation.jsx
│   │   └── Navigation.css
│   ├── pages/          # Page components
│   │   ├── Home.jsx
│   │   ├── Home.css
│   │   ├── TechPortfolio.jsx
│   │   ├── TechPortfolio.css
│   │   ├── Contact.jsx
│   │   └── Contact.css
│   ├── App.jsx         # Main app component
│   ├── App.css
│   ├── main.jsx        # Entry point
│   └── index.css       # Global styles
├── index.html          # HTML template
├── vite.config.js      # Vite configuration
└── package.json        # Dependencies
```

## 🔧 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📄 License

Copyright © 2025 yorocobu LLC. All rights reserved.

## 🤝 Support

For questions or support, contact: yorocobu.llc@gmail.com

---

**Built with ❤️ by yorocobu LLC**
*Building apps for underserved markets*
