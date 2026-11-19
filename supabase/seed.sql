-- =============================================================================
-- Deskcraft sample catalog (fictional products). Prices are in cents (USD).
-- The owner account and sample orders are created with `npm run seed`, which uses the
-- Supabase Admin API so passwords are hashed by Supabase Auth.
-- =============================================================================

insert into public.categories (name, slug, description, sort_order) values
  ('Keyboards',   'keyboards',   'Mechanical and low-profile keyboards tuned for typing and play.', 1),
  ('Mice',        'mice',        'Precise sensors, light shells and all-day ergonomics.', 2),
  ('Audio',       'audio',       'Headphones and microphones for focus, calls and creating.', 3),
  ('Monitors',    'monitors',    'Sharp, fast displays for work and play.', 4),
  ('Accessories', 'accessories', 'Hubs, cameras and controllers that complete the setup.', 5),
  ('Storage',     'storage',     'Fast, reliable storage for your system and projects.', 6);

with c as (select id, slug from public.categories)
insert into public.products
  (category_id, name, slug, description, price_cents, image_url, stock_quantity, is_active, is_featured)
values
  ((select id from c where slug = 'keyboards'), 'Arc75 Wireless Mechanical Keyboard', 'arc75-wireless-mechanical-keyboard',
   'A 75% gasket-mounted keyboard with hot-swappable switches, PBT double-shot keycaps and tri-mode connectivity (USB-C, 2.4 GHz and Bluetooth 5.3). The 4,000 mAh battery lasts up to 200 hours with backlight off.',
   14900, '/products/arc75-wireless-mechanical-keyboard.jpg', 24, true, true),

  ((select id from c where slug = 'keyboards'), 'Ember 65 Hot-Swap Keyboard', 'ember-65-hot-swap-keyboard',
   'Compact 65% layout with an aluminium top case, pre-lubed linear switches and a silicone dampening stack for a deep, quiet sound. Wired USB-C with a detachable braided cable.',
   11900, '/products/ember-65-hot-swap-keyboard.jpg', 12, true, false),

  ((select id from c where slug = 'mice'), 'Vector Pro Wireless Gaming Mouse', 'vector-pro-wireless-gaming-mouse',
   'A 58 g ultralight shell with a 26K DPI optical sensor, optical switches rated for 90 million clicks and 1 ms 2.4 GHz wireless. PTFE feet and up to 80 hours per charge.',
   12900, '/products/vector-pro-wireless-gaming-mouse.jpg', 18, true, true),

  ((select id from c where slug = 'mice'), 'Glide Ergonomic Wireless Mouse', 'glide-ergonomic-wireless-mouse',
   'Sculpted right-handed shape with a soft-touch finish, silent clicks and a hyper-fast scroll wheel. Connects over Bluetooth or the included USB-C receiver.',
   4900, '/products/glide-ergonomic-wireless-mouse.jpg', 55, true, false),

  ((select id from c where slug = 'audio'), 'Pulse ANC Wireless Headphones', 'pulse-anc-wireless-headphones',
   'Hybrid active noise cancelling, 40 mm dynamic drivers and up to 45 hours of playback. Multipoint Bluetooth 5.3 keeps your laptop and phone connected at the same time.',
   29900, '/products/pulse-anc-wireless-headphones.jpg', 9, true, true),

  ((select id from c where slug = 'audio'), 'Reference Studio Headphones', 'reference-studio-headphones',
   'Closed-back studio headphones with a flat, honest frequency response for mixing and editing. Swivelling ear cups, replaceable velour pads and a detachable 3 m cable.',
   17900, '/products/reference-studio-headphones.jpg', 0, true, false),

  ((select id from c where slug = 'audio'), 'Echo USB Condenser Microphone', 'echo-usb-condenser-microphone',
   'Cardioid condenser microphone with 24-bit/96 kHz USB-C output, zero-latency headphone monitoring and a tap-to-mute capacitive sensor. Ships with a desk boom arm and pop filter.',
   12900, '/products/echo-usb-condenser-microphone.jpg', 16, true, true),

  ((select id from c where slug = 'monitors'), 'Vista 27" 4K IPS Monitor', 'vista-27-4k-ips-monitor',
   '27-inch 4K IPS panel covering 98% DCI-P3, factory-calibrated to ΔE < 2. USB-C with 90 W power delivery turns it into a single-cable laptop dock.',
   44900, '/products/vista-27-4k-ips-monitor.jpg', 7, true, true),

  ((select id from c where slug = 'monitors'), 'Horizon 34" Ultrawide 165 Hz', 'horizon-34-ultrawide-165hz',
   '34-inch 1500R curved WQHD display with a 165 Hz refresh rate, 1 ms response time and adaptive sync. A height-adjustable stand and VESA mount are included.',
   79900, '/products/horizon-34-ultrawide-165hz.jpg', 4, true, false),

  ((select id from c where slug = 'accessories'), 'Nexus 8-in-1 USB-C Hub', 'nexus-8-in-1-usb-c-hub',
   'Aluminium hub with 4K60 HDMI, 100 W pass-through charging, gigabit Ethernet, SD and microSD readers plus two 10 Gbps USB-A ports. Fits in any laptop sleeve.',
   5900, '/products/nexus-8-in-1-usb-c-hub.jpg', 60, true, false),

  ((select id from c where slug = 'accessories'), 'Clarity 4K Streaming Webcam', 'clarity-4k-streaming-webcam',
   '4K30 / 1080p60 webcam with a large 1/2.8" sensor, auto light correction and dual noise-reducing microphones. Includes a privacy shutter and a universal mount.',
   13900, '/products/clarity-4k-streaming-webcam.jpg', 11, true, false),

  ((select id from c where slug = 'storage'), 'Bolt 2TB NVMe SSD', 'bolt-2tb-nvme-ssd',
   'PCIe 4.0 NVMe M.2 2280 drive with sequential reads up to 7,300 MB/s and a graphene heat spreader. Backed by a five-year limited warranty.',
   15900, '/products/bolt-2tb-nvme-ssd.jpg', 30, true, false);
