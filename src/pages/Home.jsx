import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo/Leaders_logo.png';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full h-screen bg-linear-to-br from-[#1a1a1a] to-[#2d3436] flex justify-center items-center text-white font-sans">
      <div className="text-center flex flex-col gap-12 p-8 bg-white/5 backdrop-blur-md rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] border border-white/18 min-w-[300px] max-w-[500px] w-[90%]">
        <div className="flex justify-center">
          <img src={logo} alt="Leaders Logo" className="max-w-full h-auto max-h-[150px] drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]" />
        </div>
        
        <div className="flex flex-col gap-6">
          <button 
            className="py-4 px-8 text-xl font-semibold text-[#1a1a1a] bg-linear-to-r from-[#f1c40f] to-[#f39c12] border-none rounded-full cursor-pointer transition-all duration-300 uppercase tracking-wider shadow-[0_4px_15px_rgba(243,156,18,0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(243,156,18,0.5)] hover:from-[#f39c12] hover:to-[#e67e22] active:translate-y-px"
            onClick={() => navigate('/game', { state: { mode: 'ai' } })}
          >
            Vs AI
          </button>
          <button 
            className="py-4 px-8 text-xl font-semibold text-[#1a1a1a] bg-linear-to-r from-[#f1c40f] to-[#f39c12] border-none rounded-full cursor-pointer transition-all duration-300 uppercase tracking-wider shadow-[0_4px_15px_rgba(243,156,18,0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(243,156,18,0.5)] hover:from-[#f39c12] hover:to-[#e67e22] active:translate-y-px"
            onClick={() => navigate('/game', { state: { mode: 'player' } })}
          >
            Vs Player
          </button>
        </div>

        <footer className="mt-4 text-white/60 text-sm">
          <p className="mb-2 uppercase tracking-widest text-xs">Created by</p>
          <div className="flex justify-center gap-2 items-center">
            <span>Tegar</span>
            <span className="text-[#f1c40f]">•</span>
            <span>Nicholas</span>
            <span className="text-[#f1c40f]">•</span>
            <span>Sebastian</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;
