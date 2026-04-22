import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GlobalStyle } from './styles/GlobalStyle';
import { DiveProvider } from './store/DiveContext';
import HomePage from './pages/HomePage';
import SessionPage from './pages/SessionPage';
import RawDataPage from './pages/RawDataPage';
import DivePage from './pages/DivePage';
import ComparePage from './pages/ComparePage';
import TrendsPage from './pages/TrendsPage';

function App() {
  return (
    <BrowserRouter>
      <DiveProvider>
        <GlobalStyle />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/session" element={<SessionPage />} />
          <Route path="/raw" element={<RawDataPage />} />
          <Route path="/dive/:id" element={<DivePage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/trends" element={<TrendsPage />} />
        </Routes>
      </DiveProvider>
    </BrowserRouter>
  );
}

export default App;
