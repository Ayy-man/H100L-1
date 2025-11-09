
import React from 'react';

interface FooterProps {
  content: {
    copy: string;
  };
}

const Footer: React.FC<FooterProps> = ({ content }) => {
  return (
    <footer className="bg-gray-900 border-t border-gray-800">
      <div className="container mx-auto px-6 py-8 text-center text-gray-500">
        <p>{content.copy}</p>
      </div>
    </footer>
  );
};

export default Footer;
