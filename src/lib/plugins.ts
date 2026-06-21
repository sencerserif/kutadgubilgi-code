import type { Plugin } from "@/types";

export const BUILTIN_PLUGINS: Plugin[] = [
  {
    id: "plugin-web-search",
    name: "Web Arama",
    description: "AI'ınıza gerçek zamanlı web arama yeteneği kazandırır",
    version: "1.0.0",
    author: "Kutadgubilgi Code",
    enabled: false,
    isBuiltIn: true,
    icon: "search",
    category: "search",
    config: {
      maxResults: 5,
      engine: "duckduckgo",
    },
    configSchema: [
      {
        key: "maxResults",
        label: "Maksimum sonuç sayısı",
        type: "number",
        default: 5,
      },
      {
        key: "engine",
        label: "Arama motoru",
        type: "select",
        default: "duckduckgo",
        options: [
          { label: "DuckDuckGo", value: "duckduckgo" },
          { label: "Google CSE", value: "google" },
          { label: "Bing", value: "bing" },
        ],
      },
    ],
  },
  {
    id: "plugin-slack",
    name: "Slack Entegrasyonu",
    description: "AI yanıtlarını Slack kanalına gönderin",
    version: "1.0.0",
    author: "Kutadgubilgi Code",
    enabled: false,
    isBuiltIn: true,
    icon: "message",
    category: "integration",
    config: {
      webhookUrl: "",
      channel: "#general",
    },
    configSchema: [
      {
        key: "webhookUrl",
        label: "Slack Webhook URL",
        type: "string",
        required: true,
      },
      {
        key: "channel",
        label: "Kanal",
        type: "string",
        default: "#general",
      },
    ],
  },
  {
    id: "plugin-jira",
    name: "Jira Bağlayıcı",
    description: "Jira ticket'larını çek ve AI ile yönet",
    version: "1.0.0",
    author: "Kutadgubilgi Code",
    enabled: false,
    isBuiltIn: true,
    icon: "ticket",
    category: "integration",
    config: {
      domain: "",
      apiToken: "",
    },
    configSchema: [
      {
        key: "domain",
        label: "Jira domain (örn: company.atlassian.net)",
        type: "string",
        required: true,
      },
      {
        key: "apiToken",
        label: "API Token",
        type: "string",
        required: true,
      },
    ],
  },
  {
    id: "plugin-db",
    name: "Veritabanı Sorgulama",
    description: "SQL çalıştır ve AI'ın sonuçları analiz etmesine izin ver",
    version: "1.0.0",
    author: "Kutadgubilgi Code",
    enabled: false,
    isBuiltIn: true,
    icon: "database",
    category: "data",
    config: {
      connectionString: "",
      type: "postgres",
    },
    configSchema: [
      {
        key: "connectionString",
        label: "Connection String",
        type: "string",
        required: true,
      },
      {
        key: "type",
        label: "Veritabanı tipi",
        type: "select",
        default: "postgres",
        options: [
          { label: "PostgreSQL", value: "postgres" },
          { label: "MySQL", value: "mysql" },
          { label: "SQLite", value: "sqlite" },
        ],
      },
    ],
  },
  {
    id: "plugin-figma",
    name: "Figma",
    description: "Figma tasarımını koda çevir",
    version: "1.0.0",
    author: "Kutadgubilgi Code",
    enabled: false,
    isBuiltIn: true,
    icon: "figma",
    category: "tool",
    config: {
      accessToken: "",
    },
    configSchema: [
      {
        key: "accessToken",
        label: "Figma Access Token",
        type: "string",
        required: true,
      },
    ],
  },
  {
    id: "plugin-openapi",
    name: "OpenAPI Test",
    description: "OpenAPI spec'inden otomatik API test'leri üret",
    version: "1.0.0",
    author: "Kutadgubilgi Code",
    enabled: false,
    isBuiltIn: true,
    icon: "api",
    category: "tool",
    config: {
      specUrl: "",
    },
    configSchema: [
      {
        key: "specUrl",
        label: "OpenAPI Spec URL",
        type: "string",
        required: true,
      },
    ],
  },
];
