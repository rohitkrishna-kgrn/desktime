import './globals.css';

export const metadata = {
  title: 'DeskTime — Employee Monitoring',
  description: 'Enterprise employee productivity and attendance platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
