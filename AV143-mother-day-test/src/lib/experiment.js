/**
 * ID - Description
 *
 * @fileoverview The main experiment logic goes here. Everything should be written inside the
 * activate function which is called if the conditions in triggers.js have passed evaluation
 * @author User Conversion
 */

import Splide from '@splidejs/splide';
import { setup, fireEvent } from '../../../../../core-files/services';
import shared from '../../../../../core-files/shared';
import { insertAfterElement, pollerLite, sendHttpRequest, checkIntersection } from '../../../../../lib/utils';

const { ID, VARIATION } = shared;

export default () => {
  setup();

  fireEvent('Test Code Fired');

  if (window.location.pathname === '/cart') {
    fireEvent('User is on /cart page');

    if (VARIATION == 'control') {
      checkIntersection(document.querySelector('.continue-shopping'), 0, false).then(() => {
        fireEvent('Conditions Met');
      });
      //return;
    }

    fetch('/cart.json')
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        const basketProducts = data.items;
        const sampleInBasket = basketProducts.reduce((acc, curr) => {
          let lineSampleQuantity;
          if (curr['product_title'].indexOf('Sample') !== -1) {
            lineSampleQuantity = curr.quantity * 1;
          }

          return acc + lineSampleQuantity;
        }, 0);

        if (sampleInBasket > 2) {
          fireEvent(`User has at least 3 samples in their basket (${sampleInBasket} samples)`);
        }
      });
  }
  if (VARIATION === 'control') {
    return;
  } else {
    pollerLite(['#basket-main', () => window.location.pathname === '/cart'], () => {
      pollerLite(['.AV083__promo-message'], () => {
        const discountCodeMessage = document.querySelector('.AV083__promo-message');
        discountCodeMessage.innerHTML = /* HTML */ `Sample <span>discount</span> applied at checkout`;
      });

      const basketContainer = document.querySelector('form');

      const rootElement = document.createElement('div');
      rootElement.classList.add(`${ID}-root`);
      rootElement.innerHTML = /* HTML */ `
        <div class="${ID}-container">
          <div class="${ID}-header">
            <div class="${ID}-header-content">
              <h4 class="${ID}-header-title">
                ${VARIATION === '1' ? 'SHOPPING FOR MOTHERS DAY?' : 'Find your next fragrance'}
              </h4>
              <p>Finish your gift with a gift bag.</p>
            </div>
          </div>
          <div class="${ID}-loader"></div>
          <div class="${ID}-splide">
            <div class="splide__track">
              <ul class="splide__list"></ul>
            </div>
          </div>
        </div>
      `;

      insertAfterElement(basketContainer, rootElement);

      const carousel = new Splide(`.${ID}-splide`, {
        breakpoints: {
          725: {
            perPage: 1,
            fixedWidth: 200,
            gap: 40,
            focus: 'center',
            padding: 10,
            drag: true,
            pagination: true,
          },
          850: {
            gap: 30,
          },
        },
        perPage: 3,
        gap: 90,
        arrows: false,
        padding: 50,
        drag: false,
        pagination: false,
        dragMinThreshold: 10,
        flickPower: 100,
      });

      carousel.mount();
      carousel.on('move', function () {
        fireEvent(`User swipes through products on mobile`);
      });

      let allSampleProductUrls;
      //https://avon.uk.com/products/dark-circle-corrector-dual-sachet
      if (VARIATION === '1') {
        allSampleProductUrls = [
          'https://avon.uk.com/products/small-gift-bag',
          'https://avon.uk.com/products/medium-gift-bag'
        ];
      }

      const promises = [];

      allSampleProductUrls.forEach((url) =>
        promises.push(
          sendHttpRequest('GET', url).then((res) => {
            const temp = document.createElement('html');
            temp.innerHTML = res;

            const title = temp.querySelector('.product-title.main-product-title').innerText;
            const price = temp.querySelector('.product-price .money')?.innerText;
            const prevPrice = temp.querySelector('.original-price.money').innerText;
            const image = temp.querySelectorAll('#product-large-images img')[0].src;
            const soldOut = !!temp.querySelector('.notify:not(.hide)');
            const form = temp.querySelector('.shopify-product-form');
            const variantId = form.querySelector('.variant-id').value;
            const currentPrice = parseInt(price.split('£')[1]);
            const previousPrice = parseInt(prevPrice.split('£')[1]);
            const discountPercent = prevPrice ? ((previousPrice - currentPrice) * 100) / previousPrice : '0';
            //console.log('file: experiment.js ~ line 142 ~ sendHttpRequest ~ discountPercent', discountPercent);
            return {
              url,
              title,
              price,
              prevPrice,
              image,
              soldOut,
              variantId,
              discountPercent,
            };
          })
        )
      );

      let sampleProducts;

      Promise.all(promises).then((res) => {
        document.querySelector(`.${ID}-loader`).remove();
        sampleProducts = res;

        let i = 0;
        let iterations = 0;

        while (i < sampleProducts.length && iterations <= 2) {
          const product = sampleProducts[i];
          i += 1;

          //console.log('product', product);
          if (product.soldOut) {
            continue;
          }

          iterations += 1;

          const isAlreadyInBasket = !!document
            .getElementById('basket-main')
            .querySelector(`[data-variant-id="${product.variantId}"]`);

          const btnText = isAlreadyInBasket ? 'Added' : product.soldOut ? 'Out of stock' : 'Add to basket';

          if (product.soldOut) {
            fireEvent(`${product.title} is out of stock`);
          }

          carousel.add(/* HTML */ `
            <li class="splide__slide ${ID}__splide-slide">
              <div class="${ID}-product-card" data-sample-card>
                <a class="${ID}-product-card-image" href="${product.url}">
                  <img src="${product.image}" alt="${product.title}" />
                  ${product.discountPercent > 0
                    ? `<span class="${ID}-product-card-discount-label">${product.discountPercent.toFixed(0)}% OFF</span>`
                    : ''}
                </a>
                <div class="${ID}-product-card-content">
                  <a class="${ID}-product-card-title" href="${product.url}">
                    <h5>${product.title}</h5>
                  </a>
                  <p>
                    <span class="${ID}-product-card-price">${product.price}</span>
                    <span class="${ID}-product-card-prevprice">${product.prevPrice}</span>
                  </p>
                  <form
                    method="post"
                    action="/cart/add?id[]=${product.variantId}"
                    accept-charset="UTF-8"
                    class="shopify-product-form"
                    enctype="multipart/form-data"
                  >
                    <input type="hidden" name="id" class="variant-id" value="${product.variantId}" />
                    <button
                      class="${ID}-cta ${ID}-ghost ${ID}__${btnText.split(' ').join('')}"
                      type="submit"
                      data-title="${product.title}"
                    >
                      ${btnText}
                    </button>
                  </form>
                </div>
              </div>
            </li>
          `);
        }

        //const addAllSamplesForm = document.querySelector(`.${ID}-header form`);
        const addAllSamplesButton = document.querySelector(`.${ID}-header .${ID}-cta`);
        const allSampleIds = document.querySelectorAll(`.${ID}-product-card .variant-id`);
        const ids = [];

        allSampleIds.forEach((id) => ids.push(id.value));

        //const requestString = `cart/add?${ids.map((id) => `id[]=${id}`).join('&')}`;

        //addAllSamplesForm.action = requestString;

        document.querySelectorAll(`.${ID}-product-card .${ID}-cta`).forEach((item) => {
          item.addEventListener('click', ({ target }) => {
            fireEvent(`User adds ${target.dataset.title} to basket`);
          });
        });

        const availableSamples = document.querySelectorAll(`.${ID}-product-card`);

        if (availableSamples.length < 3) {
          addAllSamplesButton?.remove();
        } else {
          addAllSamplesButton?.classList.add('visible');
        }

        availableSamples.forEach((sample) => {
          const cta = sample.querySelector(`.${ID}-cta`);
          cta.addEventListener('click', () => {
            cta.innerText = 'Adding';
          });
        });

        const carouselLength = document.querySelectorAll(`.${ID}__splide-slide`).length;


        checkIntersection(rootElement, 0, false).then(() => {
          fireEvent('Conditions Met');
          fireEvent('User view the component');
          
        });
      });
    });
  }
};
