import Sidebar from "./Sidebar";
import BackgroundBlobs from "./BackgroundBlobs";
import NotificationManager from "./NotificationManager";
import BackendStatus from "./BackendStatus";
import UserMenu from "./UserMenu";
import ThemeControls from "./ThemeControls";

function AppShell({ children, user }) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        position: "relative",
      }}
    >
      <BackgroundBlobs />
      <NotificationManager />
      <BackendStatus />
      <UserMenu user={user} />

      {/* Text-size + light/dark controls. Sits left of the auth UserMenu when
          it's present (auth mode), otherwise tucks into the top-right corner. */}
      <div style={{ position: "fixed", top: 16, right: user ? 240 : 20, zIndex: 60 }}>
        <ThemeControls />
      </div>

      <Sidebar />

      <main
        style={{
          flex: 1,
          padding: "40px",
          overflowY: "auto",
          position: "relative",
          zIndex: 1,
          scrollBehavior: "smooth",
        }}
      >
        <div
          style={{
            maxWidth: "1600px",
            margin: "0 auto",
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

export default AppShell;