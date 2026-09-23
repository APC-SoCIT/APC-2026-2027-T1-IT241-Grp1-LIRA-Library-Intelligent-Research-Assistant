import { useState } from 'react'
import { FiArrowUp, FiAtSign, FiBookOpen, FiChevronDown, FiFacebook, FiLogIn, FiUser } from 'react-icons/fi'
import OpacPage from './OpacPage'

export default function CatalogAccessPage() {
  const [hasDemoAccess, setHasDemoAccess] = useState(false)

  if (hasDemoAccess) {
    return <OpacPage />
  }

  return (
    <div className="catalog-access-page">
      <header className="catalog-utility-bar">
        <div className="catalog-koha-mark" aria-label="Koha library system">
          <FiBookOpen aria-hidden="true" />
          <span>koha</span>
        </div>
        <nav className="catalog-utility-links" aria-label="Catalog utility navigation">
          <button type="button" onClick={() => setHasDemoAccess(true)}>
            <FiUser aria-hidden="true" />
            Log in to your account
          </button>
          <button type="button">
            Languages
            <FiChevronDown aria-hidden="true" />
          </button>
        </nav>
      </header>

      <div className="catalog-brand-banner">
        <div className="catalog-brand-mark" aria-hidden="true">
          <span className="catalog-brand-mark-head" />
          <span className="catalog-brand-mark-body" />
        </div>
        <div>
          <p>ASIA PACIFIC COLLEGE LIBRARY</p>
          <h1>Online Public Access Catalog</h1>
        </div>
      </div>

      <main className="catalog-access-main">
        <section className="catalog-intro" aria-labelledby="catalog-access-title">
          <h2 id="catalog-access-title">Explore the Collection</h2>
          <p>Search for books, digital resources, theses, and more.</p>
        </section>

        <section className="catalog-login-panel">
          <div className="catalog-gold-rule" />
          <h2>Access the library resources using your<br />APC Microsoft Account</h2>
          <button
            type="button"
            className="catalog-microsoft-login"
            onClick={() => setHasDemoAccess(true)}
          >
            <FiLogIn aria-hidden="true" />
            Log in with Microsoft Account
          </button>

          <div className="catalog-external-card">
            <h3>For External Researchers</h3>
            <p>Contact us through the details below and our library staff will help you set up your access credentials.</p>
            <div className="catalog-contact-list">
              <a href="mailto:library@apc.edu.ph">
                <FiAtSign aria-hidden="true" />
                library@apc.edu.ph
              </a>
              <a href="https://www.facebook.com/apc.library" target="_blank" rel="noreferrer">
                <FiFacebook aria-hidden="true" />
                Asia Pacific College Library
              </a>
            </div>
          </div>
        </section>

        <button type="button" className="catalog-forgot-link">Forgot your password?</button>
      </main>

      <footer className="catalog-access-footer">
        <span>Asia Pacific College Library</span>
        <span>library@apc.edu.ph</span>
      </footer>

      <button
        type="button"
        className="catalog-back-to-top"
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <FiArrowUp aria-hidden="true" />
      </button>
    </div>
  )
}