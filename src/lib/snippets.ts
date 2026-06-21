import type { Snippet } from "@/types";

export const BUILTIN_SNIPPETS: Snippet[] = [
  {
    id: "builtin-code-explain",
    title: "Kodu Açıkla",
    description: "Seçili kodun ne yaptığını detaylıca açıkla",
    prompt:
      "Aşağıdaki kodu satır satır incele ve ne yaptığını, nasıl çalıştığını, olası iyileştirmeleri Türkçe olarak açıkla:\n\n```\n{{code}}\n```",
    category: "code",
    isBuiltIn: true,
    createdAt: 0,
    useCount: 0,
  },
  {
    id: "builtin-test-gen",
    title: "Unit Test Yaz",
    description: "Seçili kod için kapsamlı unit test'leri üret",
    prompt:
      "Aşağıdaki fonksiyon/component için kapsamlı unit test'leri yaz. Edge case'leri dahil et. Jest + Testing Library kullan:\n\n```\n{{code}}\n```\n\nÇıktıyı doğrudan çalıştırılabilir bir test dosyası olarak ver.",
    category: "test",
    isBuiltIn: true,
    createdAt: 0,
    useCount: 0,
  },
  {
    id: "builtin-refactor",
    title: "Refactor Et",
    description: "Kodu daha temiz ve performanslı hale getir",
    prompt:
      "Aşağıdaki kodu refactor et. Hedefler:\n- Daha okunabilir\n- DRY prensibi\n- SOLID prensipleri\n- Performans\n\nÖnce mevcut sorunları listele, sonra refactor edilmiş kodu ver:\n\n```\n{{code}}\n```",
    category: "refactor",
    isBuiltIn: true,
    createdAt: 0,
    useCount: 0,
  },
  {
    id: "builtin-docstring",
    title: "Docstring Ekle",
    description: "Tüm fonksiyonlara docstring/JSDoc ekle",
    prompt:
      "Aşağıdaki koda TSDoc/JSDoc açıklamaları ekle. Parametreler, dönüş değeri, örnek kullanım dahil:\n\n```\n{{code}}\n```",
    category: "doc",
    isBuiltIn: true,
    createdAt: 0,
    useCount: 0,
  },
  {
    id: "builtin-find-bugs",
    title: "Hata Bul",
    description: "Olası bug'ları ve güvenlik açıklarını tespit et",
    prompt:
      "Aşağıdaki kodda olası bug'ları, güvenlik açıklarını ve mantık hatalarını bul. Her birini önem seviyesiyle listele ve düzeltme öner:\n\n```\n{{code}}\n```",
    category: "review",
    isBuiltIn: true,
    createdAt: 0,
    useCount: 0,
  },
  {
    id: "builtin-convert-lang",
    title: "Dil Çevir",
    description: "Kodu başka bir dile çevir (Python→TS, TS→Go vb.)",
    prompt:
      "Aşağıdaki kodu {{target_lang}} diline çevir. Aynı işlevselliği koru, o dilin best practice'lerini uygula:\n\n```\n{{code}}\n```",
    category: "code",
    isBuiltIn: true,
    createdAt: 0,
    useCount: 0,
  },
  {
    id: "builtin-regex",
    title: "Regex Yaz",
    description: "İhtiyacın olan regex'i oluştur",
    prompt:
      "Şu gereksinim için bir regex yaz: {{requirement}}\n\nRegex'i, açıklamasını ve test case'lerini ver.",
    category: "code",
    isBuiltIn: true,
    createdAt: 0,
    useCount: 0,
  },
  {
    id: "builtin-commit-msg",
    title: "Commit Mesajı",
    description: "Diff'ten conventional commit mesajı üret",
    prompt:
      "Aşağıdaki git diff'ini inceley conventional commit formatında (feat/fix/docs/refactor/test/chore) Türkçe commit mesajı üret:\n\n```\n{{diff}}\n```",
    category: "doc",
    isBuiltIn: true,
    createdAt: 0,
    useCount: 0,
  },
];
