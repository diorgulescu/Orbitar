# SPDX-License-Identifier: GPL-3.0-or-later
# Makefile pentru compilarea cărții „Orbitar — Enciclopedia Cosmică Ilustrată”

PDF = orbitar-carte.pdf
TEX = orbitar-carte.tex
CHAPTERS = $(wildcard capitole/*.tex)

.PHONY: all pdf regen clean distclean

all: pdf

regen:
	node ./genereaza-capitole.mjs

pdf: $(TEX) $(CHAPTERS)
	./build.sh

clean:
	rm -f *.aux *.log *.out *.toc *.lof *.lot *.fls *.fdb_latexmk *.synctex.gz capitole/*.aux

distclean: clean
	rm -f $(PDF)
