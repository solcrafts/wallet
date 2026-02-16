import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Circle } from 'lucide-react';
import '../styles/neu.css';

const NetworkSelector = ({ network, setNetwork, networks }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (key) => {
        setNetwork(key);
        setIsOpen(false);
    };

    const currentNetwork = networks[network] || { name: 'Unknown' };

    return (
        <div ref={dropdownRef} className="network-dropdown" style={{ minWidth: 150 }}>
            <button
                type="button"
                className="neu-btn neu-btn--sm"
                onClick={() => setIsOpen((prev) => !prev)}
                style={{ justifyContent: 'space-between', textTransform: 'none' }}
            >
                <span className="row gap-8" style={{ fontWeight: 700 }}>
                    <Circle size={10} fill="#20a567" color="#20a567" />
                    {currentNetwork.name}
                </span>
                <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }} />
            </button>

            {isOpen && (
                <div className="network-menu fade-up">
                    {Object.entries(networks).map(([key, net]) => (
                        <button
                            key={key}
                            type="button"
                            className={`network-item ${network === key ? 'active' : ''}`}
                            onClick={() => handleSelect(key)}
                        >
                            {net.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NetworkSelector;