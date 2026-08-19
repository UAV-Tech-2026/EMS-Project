import React from "react";
import RequestPanelContent from "../components/RequestPanelContent";


export default function RequestPanel() {
  const user = JSON.parse(sessionStorage.getItem("user")) || {};
  
  return (
    <div style={{ padding: "24px", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <RequestPanelContent role={user.role || "employee"} />
      </div>
    </div>
  );
}
