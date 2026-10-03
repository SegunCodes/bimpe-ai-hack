import { run } from "./pool";

export async function seedDemoData(): Promise<void> {
  await run(`INSERT INTO customers (name, phone, language, address, landmark, consent_to_calls) VALUES
    ('Adaeze Okafor', '+2348031234501', 'en', '12 Admiralty Way, Lekki Phase 1, Lagos', 'Opposite the Lekki Conservation Centre gate', 1),
    ('Tunde Adebayo', '+2348062345602', 'yo', '18 Allen Avenue, Ikeja, Lagos', 'Beside the Ikeja City Mall entrance', 1),
    ('Ngozi Eze', '+2348093456703', 'ig', '4 Bode Thomas Street, Surulere, Lagos', 'Near the National Stadium main gate', 0)`);

  await run(`INSERT INTO orders (customer_id, item, seller, address_on_file, landmark, delivery_window) VALUES
    (1, 'Wireless headphones', 'Lekki Tech Hub', '12 Admiralty Way, Lekki Phase 1, Lagos', 'Opposite the Lekki Conservation Centre gate', 'Today, 2pm-5pm'),
    (2, 'Kitchen blender', 'Ikeja Home Store', '18 Allen Avenue, Ikeja, Lagos', 'Beside the Ikeja City Mall entrance', 'Tomorrow, 9am-12pm'),
    (3, 'Ankara fabric set', 'Surulere Fabrics', '4 Bode Thomas Street, Surulere, Lagos', 'Near the National Stadium main gate', 'Today, 4pm-7pm'),
    (1, 'Power bank', 'Lekki Tech Hub', '12 Admiralty Way, Lekki Phase 1, Lagos', 'Opposite the Lekki Conservation Centre gate', 'Friday, 10am-1pm'),
    (2, 'Water dispenser', 'Ikeja Home Store', '18 Allen Avenue, Ikeja, Lagos', 'Beside the Ikeja City Mall entrance', 'Saturday, 1pm-4pm')`);
}
