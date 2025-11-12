import './Home.css'
import heroLogo from '../assets/images/yweb1.png'

const Home = () => {
  return (
    <main className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-background"></div>
        <div className="container hero-content">
          <div className="hero-logo-large">
            <div className="logo-circle">
              <img src={heroLogo} alt="yorocobu" className="hero-logo-image" />
            </div>
          </div>
          <h1 className="hero-title fade-in">yorocobu LLC</h1>
          <p className="hero-tagline fade-in">Building apps for underserved markets</p>
          <div className="hero-cta fade-in">
            <a href="/tech-portfolio" className="btn btn-accent">
              View Our Tech Stack
            </a>
          </div>
        </div>
        <div className="hero-scroll-indicator">
          <div className="scroll-arrow"></div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="section mission">
        <div className="container">
          <div className="mission-content">
            <h2 className="section-title">Our Mission</h2>
            <p className="mission-text">
              Our mission is simple. We find holes in niche markets and build apps to fill them.
            </p>
          </div>
        </div>
      </section>

      {/* About the Name Section */}
      <section className="section about-name">
        <div className="container">
          <div className="about-name-content">
            <h2 className="section-title">About Our Name</h2>
            <p className="about-name-text">
              Yorocobu means "to have joy" in Japanese. Helping people find happiness drives
              everything we do. That is why we work day and night to make apps that improve
              quality of life.
            </p>
          </div>
          {/* Decorative elements */}
          <div className="decorative-grid">
            <div className="grid-item"></div>
            <div className="grid-item"></div>
            <div className="grid-item"></div>
            <div className="grid-item"></div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="section cta-section">
        <div className="container">
          <div className="cta-card">
            <h2 className="cta-title">Ready to Learn More?</h2>
            <p className="cta-text">
              Discover our technology stack and upcoming portfolio of innovative applications.
            </p>
            <div className="cta-buttons">
              <a href="/tech-portfolio" className="btn btn-primary">
                Our Technology
              </a>
              <a href="/contact" className="btn btn-accent">
                Get In Touch
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Home
