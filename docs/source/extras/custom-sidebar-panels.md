---
description: Create UIX sidebar links to Home Assistant pages and websites.
---
# Custom sidebar panels

UIX can add custom entries to the Home Assistant sidebar that open another Home Assistant page or a website. This is useful for frequently used pages that are normally nested under Settings or another panel, or for providing a shortcut to a related web service.

Open **Settings** > **Devices & services** > **UI eXtension** > **Configure**, then select **Manage custom sidebar panels**. Add a panel by choosing its icon, entering its title, and entering its target.

Enable **Admin required** to restrict the sidebar panel to administrator accounts.

Targets can be either a Home Assistant navigation path beginning with `/`, such as `/config/dashboard`, or an absolute `http` or `https` URL. Other URL schemes are not accepted.

Enable **Open in new tab** to open the target in a separate tab. The current Home Assistant tab returns to the page you were viewing. If the browser blocks the new tab, UIX opens the target in the current tab instead. Leave it disabled to open an external website in the current tab; Home Assistant navigation paths continue to use in-app navigation.

!!! note "New-tab availability"
    Opening an external target in a new tab is subject to the browser's popup-blocking policy. UIX attempts to open the tab when the sidebar panel is selected, but cannot guarantee that the browser will permit it. When blocked, UIX opens the target in the current tab instead.

Each panel has a stable internal URL managed by UIX, so you can change its title, icon, and target without recreating it. Deleting a panel immediately removes its sidebar entry.

!!! tip "Sidebar order"
    Home Assistant lets each user [reorder and hide sidebar items](https://www.home-assistant.io/dashboards/dashboards/#reorganizing-items-in-the-sidebar) from their profile.

!!! note "Redirect behaviour"
    A custom sidebar panel is a redirect, not a duplicate page. When an in-app target is selected, UIX replaces the panel URL with the configured target so browser history does not contain an extra redirect step.
