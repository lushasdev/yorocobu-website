import './Contact.css'
import ethanPhoto from '../assets/images/linkedin2.png'
import bencePhoto from '../assets/images/linkedin3.png'

const Contact = () => {
  const founders = [
    {
      name: 'Ethan Gailushas',
      title: 'Co-Founder',
      image: ethanPhoto,
    },
    {
      name: 'Bence Burton',
      title: 'Co-Founder',
      image: bencePhoto,
    },
  ]

  const socialLinks = [
    { name: 'LinkedIn', icon: '💼', url: 'https://linkedin.com/company/yorocobu', placeholder: false },
    { name: 'GitHub', icon: '📦', url: '#', placeholder: true },
    { name: 'Twitter/X', icon: '𝕏', url: '#', placeholder: true },
  ]

  return (
    <main className="contact">
      {/* Hero Section */}
      <section className="contact-hero">
        <div className="container">
          <h1 className="page-title fade-in">Partner With Us</h1>
          <p className="page-subtitle fade-in">
            Let's build something exceptional together
          </p>
        </div>
      </section>

      {/* Investor Interest Section */}
      <section className="section investor-section">
        <div className="container">
          <div className="investor-content">
            <div className="investor-icon">🚀</div>
            <h2 className="section-title">Strategic Investment Opportunity</h2>
            <p className="investor-text">
              We're seeking strategic investors who share our vision of building impactful
              applications for underserved markets. If you're interested in learning more about
              our upcoming launches and growth strategy, we'd love to hear from you.
            </p>
            <a href="mailto:yorocobu.llc@gmail.com" className="btn btn-accent investor-btn">
              Get In Touch
            </a>
          </div>
        </div>
      </section>

      {/* Founders Section */}
      <section className="section founders-section">
        <div className="container">
          <h2 className="section-title">Our Founders</h2>
          <p className="section-description">
            Meet the team behind yorocobu LLC
          </p>
          <div className="founders-grid">
            {founders.map((founder, index) => (
              <div key={index} className="founder-card card">
                <div className="founder-image">
                  <img src={founder.image} alt={founder.name} />
                </div>
                <div className="founder-info">
                  <h3 className="founder-name">{founder.name}</h3>
                  <p className="founder-title">{founder.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="section contact-section">
        <div className="container">
          <div className="contact-content">
            <h2 className="section-title">Get In Touch</h2>
            <p className="section-description">
              Have questions or want to learn more? We'd love to hear from you.
            </p>

            {/* Contact Info */}
            <div className="contact-info">
              <div className="contact-item">
                <div className="contact-icon">📧</div>
                <div className="contact-details">
                  <h4 className="contact-label">Email</h4>
                  <a href="mailto:yorocobu.llc@gmail.com" className="contact-link">
                    yorocobu.llc@gmail.com
                  </a>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="social-links">
              <h3 className="social-title">Connect With Us</h3>
              <div className="social-grid">
                {socialLinks.map((social, index) => (
                  <a
                    key={index}
                    href={social.url}
                    className="social-card card"
                    onClick={(e) => social.placeholder && e.preventDefault()}
                  >
                    <span className="social-icon">{social.icon}</span>
                    <span className="social-name">{social.name}</span>
                    {social.placeholder && (
                      <span className="social-placeholder">Coming Soon</span>
                    )}
                  </a>
                ))}
              </div>
            </div>

            {/* Additional CTA */}
            <div className="contact-cta">
              <div className="cta-box">
                <h3 className="cta-title">Ready to Start a Conversation?</h3>
                <p className="cta-text">
                  Whether you're an investor, partner, or potential client, we're excited to
                  connect and explore opportunities together.
                </p>
                <a href="mailto:yorocobu.llc@gmail.com" className="btn btn-primary">
                  Send Us a Message
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Contact
