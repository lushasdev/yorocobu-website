import './TechPortfolio.css'

const TechPortfolio = () => {
  const primaryTech = [
    { name: 'React', icon: '⚛️', description: 'Building modern web applications' },
    { name: 'React Native', icon: '📱', description: 'Cross-platform mobile apps' },
    { name: 'Swift', icon: '🍎', description: 'Native iOS development' },
    { name: 'SwiftUI', icon: '✨', description: 'Modern iOS interfaces' },
    { name: 'Flutter', icon: '🎯', description: 'Beautiful native apps' },
  ]

  const additionalTech = [
    { name: 'JavaScript', icon: 'JS' },
    { name: 'TypeScript', icon: 'TS' },
    { name: 'Python', icon: 'PY' },
    { name: 'Node.js', icon: '🟢' },
    { name: 'Firebase', icon: '🔥' },
    { name: 'PostgreSQL', icon: '🐘' },
    { name: 'AWS', icon: '☁️' },
    { name: 'Git/GitHub', icon: '📦' },
    { name: 'Figma', icon: '🎨' },
    { name: 'Docker', icon: '🐳' },
    { name: 'REST APIs', icon: '🔌' },
    { name: 'GraphQL', icon: '◈' },
  ]

  const portfolioPlaceholders = [
    { title: 'Email Platform', description: 'Coming Q4 2025' },
    { title: 'Family History App', description: 'Coming Q4 2025' },
    { title: 'Mobile Tool', description: 'Coming Q4 2025' },
    { title: 'Scheduling Program for Institutions', description: 'Coming Q4 2025' },
    { title: 'Marketplace Tool', description: 'Coming Q4 2025' },
  ]

  return (
    <main className="tech-portfolio">
      {/* Hero Section */}
      <section className="tech-hero">
        <div className="container">
          <h1 className="page-title fade-in">Our Technology</h1>
          <p className="page-subtitle fade-in">
            Building exceptional apps with industry-leading technologies
          </p>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="section tech-stack">
        <div className="container">
          <h2 className="section-title">Tech Stack</h2>
          <p className="section-description">
            We build with industry-leading technologies to deliver exceptional apps across all platforms.
          </p>

          {/* Primary Technologies */}
          <div className="tech-primary">
            <h3 className="tech-category-title">Primary Technologies</h3>
            <div className="tech-grid-primary">
              {primaryTech.map((tech, index) => (
                <div key={index} className="tech-card-large card fade-in">
                  <div className="tech-icon-large">{tech.icon}</div>
                  <h4 className="tech-name">{tech.name}</h4>
                  <p className="tech-description">{tech.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Technologies */}
          <div className="tech-additional">
            <h3 className="tech-category-title">Also Building With</h3>
            <div className="tech-grid-additional">
              {additionalTech.map((tech, index) => (
                <div key={index} className="tech-badge card">
                  <span className="tech-badge-icon">{tech.icon}</span>
                  <span className="tech-badge-name">{tech.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio Section */}
      <section className="section portfolio">
        <div className="container">
          <h2 className="section-title">Our Work</h2>
          <div className="portfolio-status">
            <div className="status-badge">
              <span className="status-dot"></span>
              <span className="status-text">Portfolio launching Q4 2025</span>
            </div>
          </div>
          <p className="section-description">
            We're currently developing innovative apps across multiple sectors.
            Check back soon to see our launches.
          </p>

          {/* Portfolio Grid */}
          <div className="portfolio-grid">
            {portfolioPlaceholders.map((app, index) => (
              <div key={index} className="portfolio-card card">
                <div className="portfolio-image-placeholder">
                  <div className="placeholder-icon">📱</div>
                  <div className="placeholder-text">Screenshot Coming Soon</div>
                </div>
                <div className="portfolio-content">
                  <h4 className="portfolio-title">{app.title}</h4>
                  <p className="portfolio-description">{app.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="portfolio-cta">
            <p className="cta-text">Interested in our upcoming launches?</p>
            <a href="/contact" className="btn btn-primary">
              Get In Touch
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}

export default TechPortfolio
