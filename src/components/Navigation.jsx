import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './Navigation.css'

const Navigation = () => {
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location])

  const isActive = (path) => location.pathname === path

  return (
    <nav className={`navigation ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-container container">
        <Link to="/" className="logo">
          <div className="logo-placeholder">Y</div>
          <span className="logo-text">Yorocobu</span>
        </Link>

        {/* Desktop Navigation */}
        <ul className="nav-links">
          <li>
            <Link
              to="/"
              className={`nav-link ${isActive('/') ? 'active' : ''}`}
            >
              Home
            </Link>
          </li>
          <li>
            <Link
              to="/tech-portfolio"
              className={`nav-link ${isActive('/tech-portfolio') ? 'active' : ''}`}
            >
              Tech & Portfolio
            </Link>
          </li>
          <li>
            <Link
              to="/contact"
              className={`nav-link ${isActive('/contact') ? 'active' : ''}`}
            >
              Contact
            </Link>
          </li>
        </ul>

        {/* Mobile Menu Button */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}></span>
        </button>

        {/* Mobile Navigation */}
        <div className={`mobile-nav ${mobileMenuOpen ? 'open' : ''}`}>
          <Link
            to="/"
            className={`mobile-nav-link ${isActive('/') ? 'active' : ''}`}
          >
            Home
          </Link>
          <Link
            to="/tech-portfolio"
            className={`mobile-nav-link ${isActive('/tech-portfolio') ? 'active' : ''}`}
          >
            Tech & Portfolio
          </Link>
          <Link
            to="/contact"
            className={`mobile-nav-link ${isActive('/contact') ? 'active' : ''}`}
          >
            Contact
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default Navigation
