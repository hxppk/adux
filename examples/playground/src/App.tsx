import React from "react";
import { Card, Space, Typography } from "antd";

export default function App() {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <Typography.Title level={2}>ADUX Playground</Typography.Title>
      <Typography.Paragraph type="secondary">
        Intentionally-bad code below. Expect red / yellow outlines from the
        ADUX runtime overlay, plus a floating panel in the bottom-right.
      </Typography.Paragraph>

      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Card title="Bare <button> (runtime-bare-button)">
          {/* intentional: bare HTML button + hardcoded colors */}
          <button
            style={{
              padding: "8px 16px",
              color: "#ffffff",
              backgroundColor: "#1677ff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            点我（应被高亮为 error）
          </button>
        </Card>

        <Card title="Hardcoded color on a div (runtime-hardcoded-color)">
          <div
            style={{
              color: "rgba(0,0,0,0.88)",
              padding: 12,
              background: "#fafafa",
            }}
          >
            This div has inline <code>color: rgba(0,0,0,0.88)</code>. Expect a
            yellow outline.
          </div>
        </Card>

        <Card title="Clean antd usage (should have NO overlay)">
          <Typography.Text>
            This card uses only antd components and tokens — the runtime
            should NOT flag anything inside it.
          </Typography.Text>
        </Card>
      </Space>
    </div>
  );
}
