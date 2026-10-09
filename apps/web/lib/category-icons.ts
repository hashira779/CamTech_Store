export const EXTENDED_ICONS: Array<{ key: string; emoji: string; category: string }> = [
  // F&B
  { key: 'coffee', emoji: '☕', category: 'Food & Drink' },
  { key: 'tea', emoji: '🍵', category: 'Food & Drink' },
  { key: 'drink', emoji: '🥤', category: 'Food & Drink' },
  { key: 'food', emoji: '🍔', category: 'Food & Drink' },
  { key: 'pizza', emoji: '🍕', category: 'Food & Drink' },
  { key: 'bakery', emoji: '🥐', category: 'Food & Drink' },
  { key: 'cake', emoji: '🎂', category: 'Food & Drink' },
  { key: 'icecream', emoji: '🍦', category: 'Food & Drink' },
  { key: 'kitchen', emoji: '🍳', category: 'Food & Drink' },

  // Tech & Electronics
  { key: 'electronics', emoji: '📱', category: 'Tech & Electronics' },
  { key: 'laptop', emoji: '💻', category: 'Tech & Electronics' },
  { key: 'headphones', emoji: '🎧', category: 'Tech & Electronics' },
  { key: 'camera', emoji: '📷', category: 'Tech & Electronics' },
  { key: 'tv', emoji: '📺', category: 'Tech & Electronics' },
  { key: 'game', emoji: '🎮', category: 'Tech & Electronics' },
  { key: 'battery', emoji: '🔋', category: 'Tech & Electronics' },

  // Retail & Fashion
  { key: 'clothing', emoji: '👕', category: 'Fashion & Retail' },
  { key: 'dress', emoji: '👗', category: 'Fashion & Retail' },
  { key: 'shoes', emoji: '👟', category: 'Fashion & Retail' },
  { key: 'accessories', emoji: '💍', category: 'Fashion & Retail' },
  { key: 'jewelry', emoji: '💎', category: 'Fashion & Retail' },
  { key: 'bag', emoji: '👜', category: 'Fashion & Retail' },
  { key: 'glasses', emoji: '🕶️', category: 'Fashion & Retail' },
  { key: 'watch', emoji: '⌚', category: 'Fashion & Retail' },
  { key: 'beauty', emoji: '💄', category: 'Fashion & Retail' },
  { key: 'perfume', emoji: '🧴', category: 'Fashion & Retail' },

  // Home & Living
  { key: 'grocery', emoji: '🛒', category: 'Home & Living' },
  { key: 'home', emoji: '🏠', category: 'Home & Living' },
  { key: 'furniture', emoji: '🪑', category: 'Home & Living' },
  { key: 'bed', emoji: '🛏️', category: 'Home & Living' },
  { key: 'garden', emoji: '🌿', category: 'Home & Living' },
  { key: 'flower', emoji: '🌸', category: 'Home & Living' },
  { key: 'tools', emoji: '🔧', category: 'Home & Living' },
  { key: 'pet', emoji: '🐾', category: 'Home & Living' },
  { key: 'clean', emoji: '🧹', category: 'Home & Living' },

  // Goods & Services
  { key: 'health', emoji: '💊', category: 'Goods & Services' },
  { key: 'sports', emoji: '⚽', category: 'Goods & Services' },
  { key: 'toys', emoji: '🧸', category: 'Goods & Services' },
  { key: 'baby', emoji: '👶', category: 'Goods & Services' },
  { key: 'books', emoji: '📚', category: 'Goods & Services' },
  { key: 'music', emoji: '🎵', category: 'Goods & Services' },
  { key: 'automotive', emoji: '🚗', category: 'Goods & Services' },
  { key: 'bike', emoji: '🚲', category: 'Goods & Services' },
  { key: 'office', emoji: '📎', category: 'Goods & Services' },
  { key: 'package', emoji: '📦', category: 'Goods & Services' },
  { key: 'gift', emoji: '🎁', category: 'Goods & Services' },
  { key: 'tag', emoji: '🏷️', category: 'Goods & Services' },
  { key: 'star', emoji: '⭐', category: 'Goods & Services' },
  { key: 'fire', emoji: '🔥', category: 'Goods & Services' },
];

export const SMART_ICON_RULES: Array<{ keywords: string[]; icons: string[] }> = [
  { keywords: ['coffee', 'cafe', 'espresso', 'cappuccino', 'latte', 'roast', 'bean'], icons: ['☕', '🍵', '🥤'] },
  { keywords: ['tea', 'matcha', 'chai', 'boba', 'herbal'], icons: ['🍵', '🥤', '🌿'] },
  { keywords: ['drink', 'beverage', 'juice', 'soda', 'cocktail', 'bar', 'beer', 'wine'], icons: ['🥤', '🍷', '🍺', '☕'] },
  { keywords: ['food', 'burger', 'sandwich', 'snack', 'fastfood', 'dining', 'lunch', 'dinner'], icons: ['🍔', '🍕', '🥪', '🍟'] },
  { keywords: ['pizza', 'pasta', 'italian', 'crust'], icons: ['🍕', '🍝', '🧀'] },
  { keywords: ['bakery', 'bread', 'pastry', 'croissant', 'bake', 'bagel', 'flour'], icons: ['🥐', '🥖', '🍞', '🍰'] },
  { keywords: ['cake', 'dessert', 'sweet', 'cupcake', 'pie', 'chocolate'], icons: ['🎂', '🧁', '🍰', '🍫'] },
  { keywords: ['icecream', 'gelato', 'frozen', 'sorbet', 'sundae'], icons: ['🍦', '🍨'] },
  { keywords: ['kitchen', 'cook', 'chef', 'utensil', 'pot', 'pan', 'dish'], icons: ['🍳', '🔪', '🍽️'] },
  { keywords: ['phone', 'mobile', 'smartphone', 'electronics', 'tech', 'gadget', 'device'], icons: ['📱', '💻', '🔋'] },
  { keywords: ['laptop', 'computer', 'pc', 'mac', 'notebook', 'desktop'], icons: ['💻', '🖥️', '⌨️'] },
  { keywords: ['headphone', 'audio', 'earphone', 'sound', 'speaker', 'music'], icons: ['🎧', '🎵', '🔊'] },
  { keywords: ['camera', 'photo', 'video', 'lens', 'photography'], icons: ['📷', '📸', '📹'] },
  { keywords: ['tv', 'television', 'monitor', 'display', 'screen'], icons: ['📺', '🖥️'] },
  { keywords: ['game', 'gaming', 'console', 'playstation', 'xbox', 'nintendo', 'steam'], icons: ['🎮', '🕹️', '🎲'] },
  { keywords: ['battery', 'charge', 'power', 'cable', 'adapter'], icons: ['🔋', '⚡', '🔌'] },
  { keywords: ['cloth', 'apparel', 'shirt', 'tshirt', 'clothing', 'wear', 'top', 'hoodie'], icons: ['👕', '👔', '🧥'] },
  { keywords: ['dress', 'skirt', 'gown', 'female', 'women', 'fashion', 'blouse'], icons: ['👗', '👠', '💄'] },
  { keywords: ['shoe', 'sneaker', 'boot', 'footwear', 'heel', 'sandal'], icons: ['👟', '👞', '👠', '👡'] },
  { keywords: ['accessory', 'accessories', 'ring', 'necklace', 'jewel', 'jewelry', 'gold'], icons: ['💍', '💎', '👑'] },
  { keywords: ['bag', 'handbag', 'backpack', 'purse', 'wallet', 'luggage', 'tote'], icons: ['👜', '🎒', '💼'] },
  { keywords: ['glass', 'glasses', 'sunglass', 'eyewear', 'optics'], icons: ['🕶️', '👓'] },
  { keywords: ['watch', 'clock', 'time', 'smartwatch'], icons: ['⌚', '⏱️'] },
  { keywords: ['beauty', 'cosmetic', 'makeup', 'lipstick', 'skincare', 'face'], icons: ['💄', '💅', '✨'] },
  { keywords: ['perfume', 'fragrance', 'cologne', 'lotion', 'scent'], icons: ['🧴', '🌸'] },
  { keywords: ['grocery', 'market', 'supermarket', 'mart', 'store', 'fresh'], icons: ['🛒', '🧺', '🏪'] },
  { keywords: ['home', 'house', 'living', 'decor', 'household'], icons: ['🏠', '🛋️', '🪑'] },
  { keywords: ['furniture', 'chair', 'table', 'sofa', 'couch', 'desk'], icons: ['🪑', '🛋️'] },
  { keywords: ['bed', 'bedroom', 'mattress', 'pillow', 'linen', 'sleep'], icons: ['🛏️', '💤'] },
  { keywords: ['garden', 'plant', 'flower', 'tree', 'botanical', 'flora', 'succulent'], icons: ['🌿', '🌸', '🌱', '🌻'] },
  { keywords: ['tool', 'hardware', 'repair', 'diy', 'screw', 'wrench', 'workshop'], icons: ['🔧', '🔨', '🛠️'] },
  { keywords: ['pet', 'dog', 'cat', 'animal', 'puppy', 'kitten', 'furry'], icons: ['🐾', '🐶', '🐱', '🦴'] },
  { keywords: ['clean', 'laundry', 'wash', 'detergent', 'sweep', 'mop'], icons: ['🧹', '🧼', '🧽'] },
  { keywords: ['health', 'medical', 'medicine', 'pharmacy', 'vitamin', 'care'], icons: ['💊', '🩹', '🩺'] },
  { keywords: ['sport', 'sports', 'fitness', 'gym', 'workout', 'ball', 'training', 'athletics'], icons: ['⚽', '🏀', '🎾', '🏋️'] },
  { keywords: ['toy', 'kids', 'child', 'children', 'game', 'play'], icons: ['🧸', '🎯', '🪁'] },
  { keywords: ['baby', 'infant', 'toddler', 'maternity', 'diaper'], icons: ['👶', '🍼', '🐣'] },
  { keywords: ['book', 'stationery', 'read', 'library', 'novel', 'education'], icons: ['📚', '📖', '📝'] },
  { keywords: ['car', 'auto', 'automotive', 'vehicle', 'motor', 'tire'], icons: ['🚗', '🏎️', '🚙'] },
  { keywords: ['bike', 'bicycle', 'cycling', 'ride'], icons: ['🚲', '🛵', '🏍️'] },
  { keywords: ['office', 'desk', 'paper', 'stationery', 'pen', 'work'], icons: ['📎', '📁', '🖋️'] },
  { keywords: ['package', 'shipping', 'box', 'delivery'], icons: ['📦', '📮'] },
  { keywords: ['gift', 'present', 'holiday', 'celebration'], icons: ['🎁', '🎉', '🎀'] },
  { keywords: ['sale', 'discount', 'deal', 'promo', 'offer', 'hot', 'special'], icons: ['🔥', '🏷️', '⭐', '⚡'] },
];

export function getSmartIconSuggestions(name: string): string[] {
  if (!name.trim()) return [];
  const words = name.toLowerCase().split(/[^a-zA-Z0-9]+/);
  const matched = new Set<string>();
  for (const item of SMART_ICON_RULES) {
    for (const w of words) {
      if (w.length >= 3 && item.keywords.some((kw) => kw === w || kw.includes(w) || w.includes(kw))) {
        item.icons.forEach((ic) => matched.add(ic));
        break;
      }
    }
  }
  return Array.from(matched).slice(0, 4);
}
