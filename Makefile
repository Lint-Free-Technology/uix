# UIX development helpers
#
# All targets assume you are running from the repository root with an activated
# virtual environment (source .venv/bin/activate).
#
# Quick reference
# ---------------
#   make doc_images_gen      Generate any missing documentation images (first-run bootstrap)
#   make doc_images_update   Regenerate ALL documentation images (use after HA/UIX visual changes)

.PHONY: doc_images_gen doc_images_update

# Run the doc-image test suite.  Missing images are created automatically;
# existing images are verified against the current rendered output.
doc_images_gen:
	pytest tests/visual/test_doc_images.py

# Regenerate all documentation images, overwriting any existing files.
# Use this after an intentional visual change to Home Assistant or UIX, then
# review the diff and commit the updated PNGs.
doc_images_update:
	DOC_IMAGE_UPDATE=1 pytest tests/visual/test_doc_images.py
