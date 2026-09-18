import "./App.css";
import Header from "./components/Header.jsx";
import MyVenues from "./components/MyVenues.jsx";
import { VenueRegisterForm } from "./components/VenueRegisterForm.jsx";

function App() {
  const isRegisterRoute = window.location.pathname === "/venues/register";

  return (
    <div className="app-shell">
      <Header />
      <main className="page-content">
        {isRegisterRoute ? (
          <VenueRegisterForm />
        ) : (
          <>
            <section className="page-intro" aria-labelledby="venues-title">
              <div>
                <p className="eyebrow">Panel del propietario</p>
                <h1 id="venues-title">Mis recintos</h1>
                <p className="page-description">
                  Administra los espacios que tienes registrados y mantén lista
                  la información que verán los organizadores.
                </p>
              </div>
              <div className="intro-decoration" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </section>
            <MyVenues />
          </>
        )}
      </main>
      <footer className="site-footer">
        <span className="brand-mark brand-mark--small" aria-hidden="true">
          V
        </span>
        <p>Venues · Encuentra el espacio para tu próximo gran evento.</p>
      </footer>
    </div>
  );
}

export default App;
