---
description: Create UIX sidebar links that redirect to any Home Assistant page.
---
# Custom sidebar panels

UIX can add custom entries to the Home Assistant sidebar that redirect directly to another Home Assistant page. This is useful for frequently used pages that are normally nested under Settings or another panel.

Open **Settings** > **Devices & services** > **UI eXtension** > **Configure**, then select **Manage custom sidebar panels**. Add a panel by choosing its icon, entering its title, and selecting its target with the navigation selector.

Enable **Admin required** to restrict the sidebar panel to administrator accounts.

Targets are Home Assistant navigation paths and must remain within your Home Assistant instance; custom sidebar panels do not redirect to external sites.

Each panel has a stable internal URL managed by UIX, so you can change its title, icon, and target without recreating it. Deleting a panel immediately removes its sidebar entry.

!!! tip "Sidebar order"
    Home Assistant lets each user [reorder and hide sidebar items](https://www.home-assistant.io/dashboards/dashboards/#reorganizing-items-in-the-sidebar) from their profile.

!!! note "Redirect behaviour"
    A custom sidebar panel is a redirect, not a duplicate page. When selected, UIX replaces the panel URL with the configured target so browser history does not contain an extra redirect step.
